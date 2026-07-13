import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Json = Record<string, unknown>;

const MANAGEMENT_API = "https://api.supabase.com/v1";
const REQUIRED_SCHEMA_VERSION = 19;
const PHASES = ["project", "availability", "database", "auth", "keys", "storage-realtime", "edge-function", "verification"] as const;
const encoder = new TextEncoder();

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

function env(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing server secret: ${name}`);
  return value;
}

function allowedOrigins() {
  return (Deno.env.get("YETLY_ALLOWED_ORIGINS") ?? "http://localhost:5173")
    .split(",").map((value) => value.trim().replace(/\/+$/, "")).filter(Boolean);
}

function cors(request: Request) {
  const origin = request.headers.get("Origin")?.replace(/\/+$/, "") ?? "";
  const allowed = allowedOrigins();
  return {
    "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0],
    "Access-Control-Allow-Headers": "authorization, content-type, x-client-info",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
    "Cache-Control": "no-store",
  };
}

function response(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(request), "Content-Type": "application/json" } });
}

function redirect(location: string) {
  return new Response(null, { status: 302, headers: { Location: location, "Cache-Control": "no-store" } });
}

function base64url(bytes: Uint8Array) {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomToken(size = 32) {
  return base64url(crypto.getRandomValues(new Uint8Array(size)));
}

async function sha256(value: string | Uint8Array) {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  return base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(env("YETLY_STATE_SECRET")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

function encryptionKeyBytes() {
  const raw = env("YETLY_ENCRYPTION_KEY").replace(/-/g, "+").replace(/_/g, "/");
  const decoded = Uint8Array.from(atob(raw + "=".repeat((4 - raw.length % 4) % 4)), (char) => char.charCodeAt(0));
  if (decoded.length !== 32) throw new Error("YETLY_ENCRYPTION_KEY must contain 32 base64 bytes");
  return decoded;
}

async function encrypt(value: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey("raw", encryptionKeyBytes(), "AES-GCM", false, ["encrypt"]);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(JSON.stringify(value))));
  return `${base64url(iv)}.${base64url(encrypted)}`;
}

function decodeBase64url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(normalized + "=".repeat((4 - normalized.length % 4) % 4)), (char) => char.charCodeAt(0));
}

async function decrypt<T>(value: string): Promise<T> {
  const [ivPart, encryptedPart] = value.split(".");
  const key = await crypto.subtle.importKey("raw", encryptionKeyBytes(), "AES-GCM", false, ["decrypt"]);
  const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decodeBase64url(ivPart) }, key, decodeBase64url(encryptedPart));
  return JSON.parse(new TextDecoder().decode(clear)) as T;
}

function safeReturnUrl(value: string) {
  const url = new URL(value);
  const allowed = allowedOrigins();
  if (!allowed.includes(url.origin)) throw new Error("Return URL origin is not allowed");
  return value;
}

async function parseJson(request: Request) {
  return await request.json().catch(() => ({})) as Json;
}

async function connectionForTicket(ticket: string) {
  if (!ticket) throw Object.assign(new Error("Missing setup ticket"), { status: 401 });
  const hash = await sha256(ticket);
  const { data: row } = await supabase.from("managed_setup_tickets")
    .select("id,connection_id,expires_at,managed_supabase_connections(*)")
    .eq("ticket_hash", hash).maybeSingle();
  if (!row || new Date(row.expires_at).getTime() <= Date.now()) throw Object.assign(new Error("Setup ticket expired"), { status: 401 });
  await supabase.from("managed_setup_tickets").update({ last_used_at: new Date().toISOString() }).eq("id", row.id);
  const connection = Array.isArray(row.managed_supabase_connections) ? row.managed_supabase_connections[0] : row.managed_supabase_connections;
  if (!connection || connection.revoked_at) throw Object.assign(new Error("Supabase authorization was revoked"), { status: 401 });
  return connection as Record<string, unknown>;
}

async function accessToken(connection: Record<string, unknown>) {
  let tokens = await decrypt<{ access_token: string; refresh_token?: string; expires_in?: number }>(String(connection.encrypted_tokens));
  const expiresAt = connection.token_expires_at ? new Date(String(connection.token_expires_at)).getTime() : 0;
  if (expiresAt > Date.now() + 60_000 || !tokens.refresh_token) return tokens.access_token;
  const form = new URLSearchParams({ grant_type: "refresh_token", refresh_token: tokens.refresh_token });
  const basic = btoa(`${env("SUPABASE_OAUTH_CLIENT_ID")}:${env("SUPABASE_OAUTH_CLIENT_SECRET")}`);
  const refreshed = await fetch(`${MANAGEMENT_API}/oauth/token`, { method: "POST", headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" }, body: form });
  if (!refreshed.ok) throw Object.assign(new Error("Supabase authorization needs reconnection"), { status: 401 });
  tokens = await refreshed.json();
  await supabase.from("managed_supabase_connections").update({
    encrypted_tokens: await encrypt(tokens),
    token_expires_at: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", connection.id);
  return tokens.access_token;
}

async function management(connection: Record<string, unknown>, path: string, init: RequestInit = {}) {
  const token = await accessToken(connection);
  const res = await fetch(`${MANAGEMENT_API}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...init.headers } });
  if (res.status === 401) throw Object.assign(new Error("Supabase authorization needs reconnection"), { status: 401 });
  if (res.status === 429) throw Object.assign(new Error("Supabase rate limit reached"), { status: 429 });
  if (!res.ok) {
    const detail = await res.text();
    throw Object.assign(new Error(`Supabase Management API ${res.status}: ${detail.slice(0, 280)}`), { status: res.status });
  }
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

async function verifiedSource(urlName: string, shaName: string, fallback: string) {
  const url = Deno.env.get(urlName) || fallback;
  const result = await fetch(url, { headers: { "Cache-Control": "no-cache" } });
  if (!result.ok) throw new Error(`Could not fetch ${urlName}`);
  const source = await result.text();
  const expected = Deno.env.get(shaName)?.trim();
  if (expected && await sha256(source) !== expected) throw new Error(`${urlName} checksum mismatch`);
  return source;
}

async function beginOAuth(request: Request) {
  const input = await parseJson(request);
  const returnUrl = safeReturnUrl(String(input.returnUrl ?? ""));
  const verifier = randomToken(48);
  const nonce = randomToken(24);
  const statePayload = `${crypto.randomUUID()}.${nonce}`;
  const state = `${statePayload}.${await sign(statePayload)}`;
  const { error } = await supabase.from("managed_oauth_sessions").insert({
    state_hash: await sha256(state), encrypted_code_verifier: await encrypt(verifier), return_url: returnUrl,
    workspace_name: String(input.workspaceName ?? "Mi espacio").slice(0, 100),
  });
  if (error) throw error;
  const callback = `${env("YETLY_CONTROL_PLANE_PUBLIC_URL").replace(/\/+$/, "")}/oauth/callback`;
  const query = new URLSearchParams({ client_id: env("SUPABASE_OAUTH_CLIENT_ID"), redirect_uri: callback, response_type: "code", state, code_challenge: await sha256(verifier), code_challenge_method: "S256" });
  return response(request, { authorizationUrl: `${MANAGEMENT_API}/oauth/authorize?${query}` });
}

async function oauthCallback(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const [id, nonce, signature] = state.split(".");
  if (!id || !nonce || !signature || await sign(`${id}.${nonce}`) !== signature) return response(request, { error: "Invalid OAuth state" }, 400);
  const { data: session } = await supabase.from("managed_oauth_sessions").select("*").eq("state_hash", await sha256(state)).maybeSingle();
  if (!session || session.used_at || new Date(session.expires_at).getTime() <= Date.now()) return response(request, { error: "OAuth session expired" }, 400);
  const callback = `${env("YETLY_CONTROL_PLANE_PUBLIC_URL").replace(/\/+$/, "")}/oauth/callback`;
  const form = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: callback, code_verifier: await decrypt<string>(session.encrypted_code_verifier) });
  const basic = btoa(`${env("SUPABASE_OAUTH_CLIENT_ID")}:${env("SUPABASE_OAUTH_CLIENT_SECRET")}`);
  const tokenResponse = await fetch(`${MANAGEMENT_API}/oauth/token`, { method: "POST", headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" }, body: form });
  if (!tokenResponse.ok) return response(request, { error: "OAuth token exchange failed" }, 401);
  const tokens = await tokenResponse.json();
  const { data: connection, error } = await supabase.from("managed_supabase_connections").insert({
    encrypted_tokens: await encrypt(tokens), token_expires_at: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
  }).select("id").single();
  if (error) throw error;
  const ticket = randomToken(32);
  await supabase.from("managed_setup_tickets").insert({ connection_id: connection.id, ticket_hash: await sha256(ticket) });
  await supabase.from("managed_oauth_sessions").update({ used_at: new Date().toISOString() }).eq("id", session.id);
  const destination = new URL(session.return_url);
  destination.searchParams.set("yetly_setup", ticket);
  return redirect(destination.toString());
}

async function listTargets(request: Request) {
  const input = await parseJson(request);
  const connection = await connectionForTicket(String(input.ticket ?? ""));
  const [organizations, projects] = await Promise.all([
    management(connection, "/organizations"), management(connection, "/projects"),
  ]) as [Array<Record<string, unknown>>, Array<Record<string, unknown>>];
  return response(request, {
    organizations: organizations.map((item) => ({ id: item.id, name: item.name })),
    projects: projects.map((item) => ({
      ref: item.ref, name: item.name, organizationId: item.organization_id,
      region: item.region, status: item.status, compatible: !["INACTIVE", "REMOVED"].includes(String(item.status)),
    })),
    canCreateProjects: true,
    canInstallExistingProjects: true,
  });
}

function publicJob(row: Record<string, unknown>) {
  const result = (row.result ?? {}) as Record<string, unknown>;
  return {
    id: row.id, status: row.status, phase: row.phase, progress: row.progress, message: row.message,
    recoverable: row.recoverable, projectRef: row.project_ref ?? result.projectRef,
    projectDashboardUrl: result.projectRef ? `https://supabase.com/dashboard/project/${result.projectRef}` : undefined,
    errorCode: row.error_code, connection: result.connection,
  };
}

async function createJob(request: Request, repair = false) {
  const input = await parseJson(request);
  const connection = await connectionForTicket(String(input.ticket ?? ""));
  const mode = repair ? "existing" : String(input.mode ?? "create");
  const projectRef = repair ? String(connection.project_ref ?? "") : String(input.projectRef ?? "");
  if (!repair && !input.organizationId) return response(request, { error: "Choose a Supabase organization" }, 400);
  const { data: row, error } = await supabase.from("managed_provisioning_jobs").insert({
    connection_id: connection.id, status: "queued", phase: repair ? "database" : "project", progress: repair ? 20 : 0,
    message: repair ? "Revisando y reparando la instalación" : "Preparando instalación",
    payload: { mode, organizationId: input.organizationId ?? connection.organization_id, projectRef, workspaceName: input.workspaceName ?? "Yetly", siteUrl: input.siteUrl, repair },
    result: projectRef ? { projectRef } : {},
  }).select("*").single();
  if (error) throw error;
  return response(request, publicJob(row));
}

async function updateJob(id: string, patch: Json) {
  const { data, error } = await supabase.from("managed_provisioning_jobs").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
  if (error) throw error;
  return data as Record<string, unknown>;
}

async function advanceJob(row: Record<string, unknown>, connection: Record<string, unknown>) {
  const payload = row.payload as Record<string, unknown>;
  const result = row.result as Record<string, unknown>;
  const phase = String(row.phase);
  const projectRef = String(result.projectRef ?? payload.projectRef ?? "");
  if (phase === "project") {
    if (payload.mode === "existing") {
      if (!projectRef) throw new Error("Choose an existing project");
      await management(connection, `/projects/${projectRef}`);
      await management(connection, `/projects/${projectRef}/database/query`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: "select 1 as yetly_preflight" }) });
      await management(connection, `/projects/${projectRef}/functions`);
      return updateJob(String(row.id), { status: "running", phase: "availability", progress: 10, message: "Proyecto validado", result: { ...result, projectRef } });
    }
    const password = `${randomToken(28)}aA1!`;
    const project = await management(connection, "/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      organization_id: payload.organizationId, name: `Yetly – ${String(payload.workspaceName).slice(0, 60)}`,
      region: Deno.env.get("YETLY_DEFAULT_REGION") || "sa-east-1", db_pass: password,
    }) });
    return updateJob(String(row.id), { status: "running", phase: "availability", progress: 8, message: "Proyecto creado; esperando que la base esté disponible", result: { ...result, projectRef: project.ref } });
  }
  if (phase === "availability") {
    const project = await management(connection, `/projects/${projectRef}`) as Record<string, unknown>;
    if (!String(project.status).includes("HEALTHY")) return updateJob(String(row.id), { status: "running", progress: 12, message: `Supabase está preparando la base (${project.status ?? "en curso"})` });
    return updateJob(String(row.id), { phase: "database", progress: 20, message: "Base disponible; instalando esquema Yetly v19" });
  }
  if (phase === "database") {
    const schema = await verifiedSource("YETLY_SCHEMA_URL", "YETLY_SCHEMA_SHA256", "https://raw.githubusercontent.com/vladimirforsend/yetly/main/ui-app/supabase/yetly-schema.sql");
    await management(connection, `/projects/${projectRef}/database/query`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: schema }) });
    return updateJob(String(row.id), { phase: "auth", progress: 48, message: "Base y seguridad listas; configurando acceso" });
  }
  if (phase === "auth") {
    const siteUrl = `${String(payload.siteUrl ?? "").replace(/\/+$/, "")}/`;
    await management(connection, `/projects/${projectRef}/config/auth`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ site_url: siteUrl, uri_allow_list: `${siteUrl},${siteUrl}**`, disable_signup: false }) });
    return updateJob(String(row.id), { phase: "keys", progress: 58, message: "Acceso configurado; obteniendo clave pública" });
  }
  if (phase === "keys") {
    const keys = await management(connection, `/projects/${projectRef}/api-keys`) as Array<Record<string, unknown>>;
    const key = keys.find((item) => item.type === "publishable" || String(item.name).toLowerCase().includes("publishable"))
      ?? keys.find((item) => item.name === "anon" || item.type === "anon");
    if (!key?.api_key) throw new Error("Supabase did not return a publishable key");
    return updateJob(String(row.id), { phase: "storage-realtime", progress: 66, message: "Clave pública lista; verificando Storage y Realtime", result: { ...result, publishableKey: key.api_key } });
  }
  if (phase === "storage-realtime") {
    return updateJob(String(row.id), { phase: "edge-function", progress: 74, message: "Archivos y tiempo real listos; instalando Ollama" });
  }
  if (phase === "edge-function") {
    const source = await verifiedSource("YETLY_OLLAMA_PROXY_URL", "YETLY_OLLAMA_PROXY_SHA256", "https://raw.githubusercontent.com/vladimirforsend/yetly/main/supabase/functions/ollama-proxy/index.ts");
    const form = new FormData();
    form.set("metadata", JSON.stringify({ entrypoint_path: "index.ts", name: "ollama-proxy", verify_jwt: true }));
    form.set("file", new File([source], "index.ts", { type: "application/typescript" }));
    await management(connection, `/projects/${projectRef}/functions/deploy?slug=ollama-proxy`, { method: "POST", body: form });
    return updateJob(String(row.id), { phase: "verification", progress: 88, message: "Ollama instalado; ejecutando pruebas finales" });
  }
  const check = await management(connection, `/projects/${projectRef}/database/query`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: "select (select version from public.yetly_schema_meta where id = 1) as version, exists(select 1 from storage.buckets where id = 'yetly-task-files') as storage_ready, exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tasks') as realtime_ready" }) }) as Array<{ version?: number; storage_ready?: boolean; realtime_ready?: boolean }>;
  if (Number(check[0]?.version) < REQUIRED_SCHEMA_VERSION || !check[0]?.storage_ready || !check[0]?.realtime_ready) throw new Error("Yetly database verification failed");
  const publishableKey = String(result.publishableKey ?? "");
  const restCheck = await fetch(`https://${projectRef}.supabase.co/rest/v1/yetly_schema_meta?select=version&id=eq.1`, { headers: { apikey: publishableKey } });
  if (!restCheck.ok) throw new Error("Yetly REST verification failed");
  const functions = await management(connection, `/projects/${projectRef}/functions`) as Array<Record<string, unknown>>;
  if (!functions.some((item) => item.slug === "ollama-proxy" && String(item.status).toUpperCase() === "ACTIVE")) throw new Error("Ollama proxy verification failed");
  const corsCheck = await fetch(`https://${projectRef}.supabase.co/functions/v1/ollama-proxy`, { method: "OPTIONS", headers: { Origin: String(payload.siteUrl ?? ""), apikey: publishableKey } });
  if (!corsCheck.ok) throw new Error("Ollama proxy CORS verification failed");
  const connectionOutput = { managed: true, projectRef, installationId: row.installation_id, schemaVersion: REQUIRED_SCHEMA_VERSION, controlPlaneUrl: env("YETLY_CONTROL_PLANE_PUBLIC_URL"), url: `https://${projectRef}.supabase.co`, publishableKey: result.publishableKey };
  await supabase.from("managed_supabase_connections").update({ project_ref: projectRef, organization_id: payload.organizationId, schema_version: REQUIRED_SCHEMA_VERSION, updated_at: new Date().toISOString() }).eq("id", connection.id);
  return updateJob(String(row.id), { status: "completed", progress: 100, message: "Instalación completa. Abriendo tu nuevo Yetly Cloud…", result: { ...result, connection: connectionOutput } });
}

async function jobStatus(request: Request, id: string) {
  const input = await parseJson(request);
  const connection = await connectionForTicket(String(input.ticket ?? ""));
  const { data: row } = await supabase.from("managed_provisioning_jobs").select("*").eq("id", id).eq("connection_id", connection.id).maybeSingle();
  if (!row) return response(request, { error: "Provisioning job not found" }, 404);
  if (row.status === "completed" || row.status === "needs_reauthorization") return response(request, publicJob(row));
  if (row.status === "failed" && input.retry !== true) return response(request, publicJob(row));
  if (row.status === "failed" && input.retry === true) {
    row.status = "running";
    row.message = "Retomando la instalación desde la última fase";
    await updateJob(id, { status: "running", message: row.message, error_code: null });
  }
  try {
    const next = await advanceJob(row, connection);
    return response(request, publicJob(next));
  } catch (cause) {
    const status = Number((cause as { status?: number }).status ?? 500);
    const needsAuth = status === 401 || status === 403;
    const retryable = status === 429 || status >= 500;
    const failed = await updateJob(id, {
      status: needsAuth ? "needs_reauthorization" : "failed", recoverable: retryable || !needsAuth,
      error_code: `SUPABASE_${status}`, message: needsAuth ? "Supabase necesita autorización nuevamente" : retryable ? "Supabase no respondió; puedes reintentar" : "No pudimos completar esta fase",
      attempts: Number(row.attempts ?? 0) + 1,
    });
    return response(request, publicJob(failed));
  }
}

async function revoke(request: Request) {
  const input = await parseJson(request);
  const connection = await connectionForTicket(String(input.ticket ?? ""));
  await supabase.from("managed_supabase_connections").update({ revoked_at: new Date().toISOString(), encrypted_tokens: await encrypt({ revoked: true }) }).eq("id", connection.id);
  return response(request, { ok: true });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors(request) });
  const url = new URL(request.url);
  const marker = "/managed-cloud";
  const route = url.pathname.includes(marker) ? url.pathname.slice(url.pathname.indexOf(marker) + marker.length) || "/" : url.pathname;
  try {
    if (route === "/oauth/start" && request.method === "POST") return await beginOAuth(request);
    if (route === "/oauth/callback" && request.method === "GET") return await oauthCallback(request);
    if (route === "/targets" && request.method === "POST") return await listTargets(request);
    if (route === "/provision" && request.method === "POST") return await createJob(request);
    if (route === "/repair" && request.method === "POST") return await createJob(request, true);
    if (route === "/revoke" && request.method === "POST") return await revoke(request);
    const job = route.match(/^\/jobs\/([0-9a-f-]+)$/i);
    if (job && request.method === "POST") return await jobStatus(request, job[1]);
    return response(request, { error: "Not found" }, 404);
  } catch (cause) {
    const status = Number((cause as { status?: number }).status ?? 500);
    // Never return secrets, SQL, tokens or full upstream responses.
    return response(request, { error: status >= 500 ? "Control Plane operation failed" : (cause instanceof Error ? cause.message : "Request failed") }, status);
  }
});

import { createClient, type AuthChangeEvent, type SupabaseClient, type User } from "@supabase/supabase-js";

export type StorageMode = "local" | "supabase";

export interface SupabaseConnectionConfig {
  url: string;
  publishableKey: string;
}

export interface ManagedConnectionMetadata {
  managed: true;
  projectRef: string;
  installationId: string;
  schemaVersion: number;
  controlPlaneUrl: string;
}

export interface SupabaseProbeResult {
  connected: boolean;
  schemaReady: boolean;
  schemaVersion?: number;
  message: string;
}

export const REQUIRED_YETLY_SCHEMA_VERSION = 19;

const CONNECTION_KEY = "yetly:v1:connection";
const OAUTH_RETURN_KEY = "yetly:v1:oauth-return";
const PASSWORD_RECOVERY_KEY = "yetly:v1:password-recovery";
const PASSWORD_RECOVERY_RETURN_KEY = "yetly:v1:password-recovery-return";
const AUTH_REDIRECT_ERROR_KEY = "yetly:v1:auth-redirect-error";
const LEGACY_LOCAL_MODE = { mode: "local" as const };

let cachedClient: SupabaseClient | null = null;
let cachedSignature = "";

function normalizeUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function legacyJwtRole(value: string): string | undefined {
  const parts = value.split(".");
  if (parts.length !== 3) return undefined;
  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
    const payload = JSON.parse(window.atob(normalized + padding)) as { role?: string };
    return payload.role;
  } catch {
    return undefined;
  }
}

function assertSafeClientKey(key: string) {
  const value = key.trim();
  if (!value) throw new Error("Falta la Publishable Key.");
  if (value.startsWith("sb_secret_")) {
    throw new Error("No pegues una Secret Key. Yetly solo acepta Publishable Keys.");
  }
  if (/service_role/i.test(value) || legacyJwtRole(value) === "service_role") {
    throw new Error("No uses service_role. Esa clave es secreta y no debe entrar al navegador.");
  }
  return value;
}

export function validateSupabaseConfig(input: SupabaseConnectionConfig): SupabaseConnectionConfig {
  const url = normalizeUrl(input.url);
  const key = assertSafeClientKey(input.publishableKey);

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("La Project URL no es una URL válida.");
  }
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
    throw new Error("La Project URL debe usar HTTPS.");
  }

  return { url, publishableKey: key };
}

export function getStorageMode(): StorageMode {
  const raw = window.localStorage.getItem(CONNECTION_KEY);
  if (!raw) return "local";
  try {
    const parsed = JSON.parse(raw) as { mode?: StorageMode };
    return parsed.mode === "supabase" ? "supabase" : "local";
  } catch {
    return "local";
  }
}

export function getSupabaseConfig(): SupabaseConnectionConfig | null {
  const raw = window.localStorage.getItem(CONNECTION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { mode?: string; config?: SupabaseConnectionConfig };
    if (parsed.mode !== "supabase" || !parsed.config) return null;
    return validateSupabaseConfig(parsed.config);
  } catch {
    return null;
  }
}

export function getManagedConnection(): (SupabaseConnectionConfig & ManagedConnectionMetadata) | null {
  const raw = window.localStorage.getItem(CONNECTION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { mode?: string; config?: SupabaseConnectionConfig; managed?: ManagedConnectionMetadata };
    if (parsed.mode !== "supabase" || !parsed.config || parsed.managed?.managed !== true) return null;
    return { ...validateSupabaseConfig(parsed.config), ...parsed.managed };
  } catch {
    return null;
  }
}

export function getPublishedSupabaseConfig(): SupabaseConnectionConfig | null {
  const env = import.meta.env;
  const url = env.VITE_YETLY_SUPABASE_URL || env.VITE_SUPABASE_URL || "";
  const publishableKey = env.VITE_YETLY_SUPABASE_PUBLISHABLE_KEY
    || env.VITE_SUPABASE_PUBLISHABLE_KEY
    || env.VITE_SUPABASE_ANON_KEY
    || "";
  if (!url || !publishableKey) return null;
  return validateSupabaseConfig({ url, publishableKey });
}

export function saveSupabaseConfig(config: SupabaseConnectionConfig) {
  const normalized = validateSupabaseConfig(config);
  window.localStorage.setItem(CONNECTION_KEY, JSON.stringify({ mode: "supabase", config: normalized }));
  cachedClient = null;
  cachedSignature = "";
}

export function saveManagedSupabaseConfig(config: SupabaseConnectionConfig & ManagedConnectionMetadata) {
  const normalized = validateSupabaseConfig(config);
  const managed: ManagedConnectionMetadata = {
    managed: true,
    projectRef: config.projectRef,
    installationId: config.installationId,
    schemaVersion: config.schemaVersion,
    controlPlaneUrl: config.controlPlaneUrl,
  };
  window.localStorage.setItem(CONNECTION_KEY, JSON.stringify({ mode: "supabase", config: normalized, managed }));
  cachedClient = null;
  cachedSignature = "";
}

export function useLocalMode() {
  window.localStorage.setItem(CONNECTION_KEY, JSON.stringify(LEGACY_LOCAL_MODE));
  cachedClient = null;
  cachedSignature = "";
}

export function clearConnectionPreference() {
  window.localStorage.removeItem(CONNECTION_KEY);
  cachedClient = null;
  cachedSignature = "";
}

export function projectRefFromUrl(url: string) {
  try {
    const host = new URL(url).hostname;
    const match = host.match(/^([a-z0-9-]+)\.supabase\.co$/i);
    return match?.[1] ?? "";
  } catch {
    return "";
  }
}

export function dashboardLinks(url: string) {
  const ref = projectRefFromUrl(url);
  const base = ref ? `https://supabase.com/dashboard/project/${ref}` : "https://supabase.com/dashboard/projects";
  return {
    projects: "https://supabase.com/dashboard/projects",
    createProject: "https://database.new",
    apiKeys: ref ? `${base}/settings/api-keys` : "https://supabase.com/dashboard/projects",
    sqlEditor: ref ? `${base}/sql/new` : "https://supabase.com/dashboard/projects",
    authProviders: ref ? `${base}/auth/providers` : "https://supabase.com/dashboard/projects",
    authUrlConfig: ref ? `${base}/auth/url-configuration` : "https://supabase.com/dashboard/projects",
    edgeFunctions: ref ? `${base}/functions` : "https://supabase.com/dashboard/projects",
    docsReact: "https://supabase.com/docs/guides/getting-started/quickstarts/reactjs",
    docsKeys: "https://supabase.com/docs/guides/getting-started/api-keys",
    docsRls: "https://supabase.com/docs/guides/database/postgres/row-level-security",
    docsAuth: "https://supabase.com/docs/guides/auth",
    docsFunctions: "https://supabase.com/docs/guides/functions/quickstart-dashboard",
  };
}

export function getSupabaseClient(config = getSupabaseConfig()): SupabaseClient {
  if (!config) throw new Error("Supabase no está conectado.");
  const normalized = validateSupabaseConfig(config);
  const signature = `${normalized.url}|${normalized.publishableKey}`;

  if (cachedClient && cachedSignature === signature) return cachedClient;

  const ref = projectRefFromUrl(normalized.url) || "custom";
  cachedClient = createClient(normalized.url, normalized.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      storageKey: `yetly:supabase-auth:${ref}`,
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  });
  cachedSignature = signature;
  return cachedClient;
}

function schemaMissing(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const text = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
  return text.includes("pgrst205")
    || text.includes("42p01")
    || text.includes("yetly_schema_meta")
    || text.includes("schema cache");
}

export async function probeSupabase(config: SupabaseConnectionConfig): Promise<SupabaseProbeResult> {
  const normalized = validateSupabaseConfig(config);
  const client = getSupabaseClient(normalized);
  const { data, error } = await client
    .from("yetly_schema_meta")
    .select("version")
    .eq("id", 1)
    .maybeSingle();

  if (!error) {
    const detectedVersion = typeof data?.version === "number" ? data.version : undefined;
    const schemaReady = detectedVersion !== undefined && detectedVersion >= REQUIRED_YETLY_SCHEMA_VERSION;
    return {
      connected: true,
      schemaReady,
      schemaVersion: detectedVersion,
      message: detectedVersion === undefined
        ? "Conexión correcta, pero el esquema Yetly todavía no está instalado."
        : schemaReady
          ? `Conexión correcta. Esquema Yetly v${detectedVersion} actualizado.`
          : `Conexión correcta, pero tu esquema Yetly v${detectedVersion} está desactualizado. Ejecuta el instalador completo para subir a v${REQUIRED_YETLY_SCHEMA_VERSION}.`,
    };
  }

  if (schemaMissing(error)) {
    return {
      connected: true,
      schemaReady: false,
      message: "Supabase responde correctamente. Falta instalar el esquema Yetly.",
    };
  }

  const message = error.message || "Supabase rechazó la conexión.";
  if (/invalid api key|jwt|401|unauthorized/i.test(message)) {
    throw new Error("Supabase rechazó la clave. Copia la Publishable Key, no una Secret Key.");
  }
  throw new Error(`No pudimos conectar con Supabase: ${message}`);
}

export async function signUpWithPassword(
  config: SupabaseConnectionConfig,
  email: string,
  password: string,
) {
  const client = getSupabaseClient(config);
  const { data, error } = await client.auth.signUp({ email: email.trim(), password });
  if (error) throw new Error(error.message);
  return data;
}

export async function signInWithPassword(
  config: SupabaseConnectionConfig,
  email: string,
  password: string,
) {
  const client = getSupabaseClient(config);
  const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(error.message);
  return data;
}

export async function signInWithGoogle(config: SupabaseConnectionConfig, returnHash = "#/connect-supabase") {
  const client = getSupabaseClient(config);
  window.sessionStorage.setItem(OAUTH_RETURN_KEY, returnHash.startsWith("#") ? returnHash : `#${returnHash}`);
  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const { error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) {
    window.sessionStorage.removeItem(OAUTH_RETURN_KEY);
    throw new Error(error.message);
  }
}

export async function getGoogleProviderStatus(config: SupabaseConnectionConfig) {
  const normalized = validateSupabaseConfig(config);
  try {
    const response = await fetch(`${normalized.url}/auth/v1/settings`, {
      headers: { apikey: normalized.publishableKey },
      cache: "no-store",
    });
    if (!response.ok) return { enabled: false, checked: false };
    const settings = await response.json() as { external?: Record<string, boolean>; external_google_enabled?: boolean };
    return { enabled: Boolean(settings.external?.google ?? settings.external_google_enabled), checked: true };
  } catch {
    return { enabled: false, checked: false };
  }
}

export async function requestPasswordRecovery(config: SupabaseConnectionConfig, email: string) {
  const client = getSupabaseClient(config);
  window.sessionStorage.setItem(PASSWORD_RECOVERY_KEY, "requested");
  if (window.location.hash.startsWith("#/connect-supabase")) window.sessionStorage.setItem(PASSWORD_RECOVERY_RETURN_KEY, window.location.hash);
  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (error) {
    window.sessionStorage.removeItem(PASSWORD_RECOVERY_KEY);
    throw new Error(error.message);
  }
}

export async function updateSupabasePassword(config: SupabaseConnectionConfig, password: string) {
  const client = getSupabaseClient(config);
  const { data, error } = await client.auth.updateUser({ password });
  if (error) throw new Error(error.message);
  window.sessionStorage.removeItem(PASSWORD_RECOVERY_KEY);
  return data.user;
}

export function captureAuthRedirectIntent() {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const queryParams = new URLSearchParams(window.location.search);
  const requestedHere = window.sessionStorage.getItem(PASSWORD_RECOVERY_KEY) === "requested";
  const redirectError = queryParams.get("error_description") || queryParams.get("error") || hashParams.get("error_description") || hashParams.get("error");
  if (hashParams.get("type") === "recovery" || queryParams.get("type") === "recovery" || (requestedHere && (queryParams.has("code") || Boolean(redirectError)))) {
    window.sessionStorage.setItem(PASSWORD_RECOVERY_KEY, "active");
    return;
  }
  if (redirectError) {
    window.sessionStorage.setItem(AUTH_REDIRECT_ERROR_KEY, redirectError);
    const returnHash = window.sessionStorage.getItem(OAUTH_RETURN_KEY);
    if (returnHash) window.sessionStorage.removeItem(OAUTH_RETURN_KEY);
    window.history.replaceState({}, "", `${window.location.pathname}${returnHash || "#/connect-supabase"}`);
  }
}

export function isPasswordRecoveryPending() {
  return window.sessionStorage.getItem(PASSWORD_RECOVERY_KEY) === "active";
}

export function activatePasswordRecoveryIntent() {
  window.sessionStorage.setItem(PASSWORD_RECOVERY_KEY, "active");
}

export function clearPasswordRecoveryIntent() {
  window.sessionStorage.removeItem(PASSWORD_RECOVERY_KEY);
  window.sessionStorage.removeItem(PASSWORD_RECOVERY_RETURN_KEY);
}

export function consumePasswordRecoveryReturnPath() {
  const path = window.sessionStorage.getItem(PASSWORD_RECOVERY_RETURN_KEY);
  window.sessionStorage.removeItem(PASSWORD_RECOVERY_RETURN_KEY);
  return path?.startsWith("#/") ? path.slice(1) : undefined;
}

export function getAuthRedirectError() {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return query.get("error_description") || query.get("error") || hash.get("error_description") || hash.get("error") || window.sessionStorage.getItem(AUTH_REDIRECT_ERROR_KEY);
}

export function clearAuthRedirectError() {
  window.sessionStorage.removeItem(AUTH_REDIRECT_ERROR_KEY);
}

export function restoreOAuthReturnPath() {
  const returnHash = window.sessionStorage.getItem(OAUTH_RETURN_KEY);
  if (!returnHash) return false;
  window.sessionStorage.removeItem(OAUTH_RETURN_KEY);
  window.location.hash = returnHash;
  return true;
}

export async function signOutSupabase() {
  const client = getSupabaseClient();
  const { error } = await client.auth.signOut();
  if (error) throw new Error(error.message);
}

export async function getSupabaseUser(config = getSupabaseConfig()): Promise<User | null> {
  if (!config) return null;
  const client = getSupabaseClient(config);
  const { data, error } = await client.auth.getUser();
  if (error) return null;
  return data.user;
}

export function onSupabaseAuthChange(callback: (event: AuthChangeEvent) => void) {
  const config = getSupabaseConfig();
  if (!config) return () => {};
  const client = getSupabaseClient(config);
  const { data } = client.auth.onAuthStateChange((event) => callback(event));
  return () => data.subscription.unsubscribe();
}

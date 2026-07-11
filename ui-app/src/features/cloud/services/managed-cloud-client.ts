import type {
  ManagedSupabaseConnection,
  ProvisioningJob,
  ProvisioningTarget,
} from "../types";

const SETUP_TICKET_KEY = "yetly:managed-cloud:setup-ticket";

function configuredBaseUrl() {
  return (import.meta.env.VITE_YETLY_MANAGED_CLOUD_URL ?? "").trim().replace(/\/+$/, "");
}

export function managedCloudAvailable() {
  return Boolean(configuredBaseUrl());
}

export function managedCloudBaseUrl() {
  const value = configuredBaseUrl();
  if (!value) throw new Error("El Cloud administrado todavía no está habilitado en esta publicación de Yetly.");
  return value;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${managedCloudBaseUrl()}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  const body = await response.json().catch(() => ({})) as { error?: string; message?: string } & T;
  if (!response.ok) {
    const message = body.message || body.error || `El servicio Cloud respondió ${response.status}.`;
    if (response.status === 401) throw new Error("La autorización Supabase venció. Vuelve a conectar tu cuenta.");
    if (response.status === 429) throw new Error("Supabase limitó temporalmente las solicitudes. Espera un momento y reintenta.");
    throw new Error(message);
  }
  return body;
}

export async function beginManagedCloudOAuth(input: { returnUrl: string; workspaceName: string }) {
  const result = await request<{ authorizationUrl: string }>("/oauth/start", {
    method: "POST",
    body: JSON.stringify(input),
  });
  window.location.assign(result.authorizationUrl);
}

export function captureManagedCloudTicket() {
  const query = new URLSearchParams(window.location.search);
  const ticket = query.get("yetly_setup");
  if (!ticket) return window.sessionStorage.getItem(SETUP_TICKET_KEY);
  window.sessionStorage.setItem(SETUP_TICKET_KEY, ticket);
  query.delete("yetly_setup");
  const suffix = query.size ? `?${query.toString()}` : "";
  window.history.replaceState({}, "", `${window.location.pathname}${suffix}${window.location.hash}`);
  return ticket;
}

export function clearManagedCloudTicket() {
  window.sessionStorage.removeItem(SETUP_TICKET_KEY);
}

function requireTicket() {
  const ticket = captureManagedCloudTicket();
  if (!ticket) throw new Error("La autorización no está disponible. Inicia nuevamente la conexión con Supabase.");
  return ticket;
}

export function listProvisioningTargets() {
  return request<ProvisioningTarget>("/targets", {
    method: "POST",
    body: JSON.stringify({ ticket: requireTicket() }),
  });
}

export function startProvisioning(input: {
  mode: "create" | "existing";
  organizationId: string;
  projectRef?: string;
  workspaceName: string;
  siteUrl: string;
}) {
  return request<ProvisioningJob>("/provision", {
    method: "POST",
    body: JSON.stringify({ ticket: requireTicket(), ...input }),
  });
}

export function getProvisioningJob(jobId: string) {
  return request<ProvisioningJob>(`/jobs/${encodeURIComponent(jobId)}`, {
    method: "POST",
    body: JSON.stringify({ ticket: requireTicket() }),
  });
}

export function retryProvisioningJob(jobId: string) {
  return request<ProvisioningJob>(`/jobs/${encodeURIComponent(jobId)}`, {
    method: "POST",
    body: JSON.stringify({ ticket: requireTicket(), retry: true }),
  });
}

export function repairManagedCloud(connection: ManagedSupabaseConnection) {
  return request<ProvisioningJob>("/repair", {
    method: "POST",
    body: JSON.stringify({ ticket: requireTicket(), installationId: connection.installationId }),
  });
}

export async function revokeManagedCloud(installationId: string) {
  await request("/revoke", {
    method: "POST",
    body: JSON.stringify({ ticket: requireTicket(), installationId }),
  });
  clearManagedCloudTicket();
}

import type { SupabaseConnectionConfig } from "../../infrastructure/supabase/supabase-connection";

export function createYetlyInviteUrl(
  baseUrl: string,
  inviteCode: string,
  config: SupabaseConnectionConfig,
) {
  const params = new URLSearchParams({
    invite: inviteCode.trim().toUpperCase(),
    supabaseUrl: config.url,
    publishableKey: config.publishableKey,
  });
  return `${baseUrl.replace(/#.*$/, "")}#/connect-supabase?${params.toString()}`;
}

export function createYetlyInviteMessage(
  baseUrl: string,
  inviteCode: string,
  config: SupabaseConnectionConfig,
) {
  const inviteUrl = createYetlyInviteUrl(baseUrl, inviteCode, config);
  return [
    "Te invito a Yetly.",
    "",
    `Entra aquí: ${inviteUrl}`,
    "",
    "Crea tu cuenta o inicia sesión. La conexión y el código de invitación ya van incluidos.",
  ].join("\n");
}

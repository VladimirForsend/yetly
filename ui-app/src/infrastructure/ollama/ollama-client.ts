import type { AiUsage, OllamaConfig, OllamaModel } from "../../features/ai/types";
import { getSupabaseClient, getSupabaseConfig, getStorageMode } from "../supabase/supabase-connection";

type OllamaChatMessage = { role: "system" | "user" | "assistant"; content: string };
type OllamaTool = Record<string, unknown>;

interface ChatChunk {
  message?: {
    content?: string;
    tool_calls?: Array<{ function?: { name?: string; arguments?: unknown } }>;
  };
  done?: boolean;
  error?: string;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

export interface OllamaChatResult {
  content: string;
  toolCalls: Array<{ name: string; arguments: unknown }>;
  usage: AiUsage;
}

export class OllamaApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

function friendlyError(status: number, fallback: string) {
  if (status === 401 || status === 403) return "La API key de Ollama es inválida o fue revocada.";
  if (status === 404) return "El modelo ya no está disponible en Ollama Cloud.";
  if (status === 429) return "Ollama alcanzó el límite de uso. Espera un momento y vuelve a intentar.";
  if (status >= 500) return "Ollama Cloud está temporalmente indisponible. Vuelve a intentar en unos minutos.";
  return fallback || "Ollama rechazó la solicitud.";
}

async function request(config: OllamaConfig, path: string, init?: RequestInit, canRefreshSession = true): Promise<Response> {
  try {
    if (getStorageMode() !== "supabase") throw new OllamaApiError("Conecta Supabase para usar Ollama Cloud desde GitHub Pages. La función segura evita el bloqueo del navegador.");
    const supabaseConfig = getSupabaseConfig();
    if (!supabaseConfig) throw new OllamaApiError("Falta la conexión Supabase de Yetly.");
    const client = getSupabaseClient();
    const { data } = await client.auth.getSession();
    if (!data.session?.access_token) throw new OllamaApiError("Inicia sesión en Yetly para usar el asistente.", 401);
    const endpoint = path.replace(/^\/api\//, "");
    const response = await fetch(`${supabaseConfig.url}/functions/v1/ollama-proxy`, {
      method: "POST",
      signal: init?.signal,
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        apikey: supabaseConfig.publishableKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        endpoint,
        ollamaApiKey: config.apiKey,
        payload: init?.body ? JSON.parse(String(init.body)) : undefined,
      }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string; message?: string };
      const errorSource = response.headers.get("X-Yetly-Error-Source");
      if (response.status === 404 && !response.headers.get("X-Yetly-Ollama-Proxy")) {
        throw new OllamaApiError("Falta desplegar la función ollama-proxy en tu proyecto Supabase.", 404);
      }
      if (response.status === 401 && errorSource !== "ollama") {
        if (canRefreshSession) {
          const { data: refreshed, error: refreshError } = await client.auth.refreshSession();
          if (!refreshError && refreshed.session?.access_token) return request(config, path, init, false);
        }
        throw new OllamaApiError("Tu sesión de Yetly expiró. Cierra sesión, vuelve a entrar y repite la consulta.", 401);
      }
      throw new OllamaApiError(friendlyError(response.status, payload.error ?? payload.message ?? ""), response.status);
    }
    return response;
  } catch (error) {
    if (error instanceof OllamaApiError || (error instanceof DOMException && error.name === "AbortError")) throw error;
    throw new OllamaApiError("No pudimos conectar con Ollama Cloud. Revisa tu conexión y vuelve a intentar.");
  }
}

export async function listOllamaModels(config: OllamaConfig): Promise<OllamaModel[]> {
  const response = await request(config, "/api/tags", { method: "GET" });
  const payload = await response.json() as { models?: Array<Record<string, any>> };
  const base = (payload.models ?? []).map((model) => ({
    name: String(model.name ?? model.model ?? ""),
    model: String(model.model ?? model.name ?? ""),
    parameterSize: model.details?.parameter_size,
    family: model.details?.family,
    capabilities: [] as string[],
  })).filter((model) => model.model);
  const result = [...base];
  let cursor = 0;
  async function inspectNext() {
    while (cursor < base.length) {
      const index = cursor++;
      try { result[index] = { ...base[index], capabilities: await showOllamaModel(config, base[index].model) }; }
      catch { result[index] = base[index]; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, base.length) }, () => inspectNext()));
  return result;
}

export async function showOllamaModel(config: OllamaConfig, model: string): Promise<string[]> {
  const response = await request(config, "/api/show", { method: "POST", body: JSON.stringify({ model }) });
  const payload = await response.json() as { capabilities?: string[] };
  return Array.isArray(payload.capabilities) ? payload.capabilities : [];
}

export async function streamOllamaChat(input: {
  config: OllamaConfig;
  model: string;
  messages: OllamaChatMessage[];
  tools?: OllamaTool[];
  signal?: AbortSignal;
  onContent: (content: string) => void;
}): Promise<OllamaChatResult> {
  const response = await request(input.config, "/api/chat", {
    method: "POST",
    signal: input.signal,
    body: JSON.stringify({
      model: input.model,
      messages: input.messages,
      tools: input.tools?.length ? input.tools : undefined,
      stream: true,
      think: false,
      options: { temperature: 0.2 },
    }),
  });
  if (!response.body) throw new OllamaApiError("Ollama no devolvió una respuesta legible.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let toolCalls: OllamaChatResult["toolCalls"] = [];
  let usage: AiUsage = {};

  const consume = (line: string) => {
    if (!line.trim()) return;
    const chunk = JSON.parse(line) as ChatChunk;
    if (chunk.error) throw new OllamaApiError(chunk.error);
    if (chunk.message?.content) {
      content += chunk.message.content;
      input.onContent(content);
    }
    if (chunk.message?.tool_calls) {
      toolCalls = chunk.message.tool_calls.map((call) => ({
        name: call.function?.name ?? "",
        arguments: call.function?.arguments,
      })).filter((call) => call.name);
    }
    if (chunk.done) {
      usage = {
        totalDuration: chunk.total_duration,
        promptTokens: chunk.prompt_eval_count,
        completionTokens: chunk.eval_count,
      };
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    lines.forEach(consume);
    if (done) break;
  }
  if (buffer.trim()) consume(buffer);
  return { content, toolCalls, usage };
}

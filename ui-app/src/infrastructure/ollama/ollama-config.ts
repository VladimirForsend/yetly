import type { OllamaConfig } from "../../features/ai/types";

const SESSION_KEY = "yetly:ollama:session";
const DEVICE_KEY = "yetly:ollama:device";

export function normalizeOllamaApiKey(input: string) {
  let value = input.trim();
  const authorizationMatch = value.match(/Authorization:\s*Bearer\s+([^'"\s\\]+)/i);
  if (authorizationMatch?.[1]) return authorizationMatch[1].trim();
  const assignmentMatch = value.match(/(?:export\s+)?OLLAMA_API_KEY\s*=\s*([^;\n]+)/i);
  if (assignmentMatch?.[1]) value = assignmentMatch[1].trim();
  value = value.replace(/^Bearer\s+/i, "").trim();
  return value.replace(/^['"`]+|['"`]+$/g, "").trim();
}

function parse(raw: string | null): OllamaConfig | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<OllamaConfig>;
    if (typeof value.apiKey !== "string" || !normalizeOllamaApiKey(value.apiKey)) return null;
    return {
      apiKey: normalizeOllamaApiKey(value.apiKey),
      defaultModel: typeof value.defaultModel === "string" ? value.defaultModel : undefined,
      remember: Boolean(value.remember),
    };
  } catch {
    return null;
  }
}

export function getOllamaConfig(): OllamaConfig | null {
  return parse(window.sessionStorage.getItem(SESSION_KEY)) ?? parse(window.localStorage.getItem(DEVICE_KEY));
}

export function saveOllamaConfig(config: OllamaConfig) {
  const apiKey = normalizeOllamaApiKey(config.apiKey);
  if (!apiKey) throw new Error("Pega una API key de Ollama.");
  const normalized = { ...config, apiKey };
  if (config.remember) {
    window.localStorage.setItem(DEVICE_KEY, JSON.stringify(normalized));
    window.sessionStorage.removeItem(SESSION_KEY);
  } else {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(normalized));
    window.localStorage.removeItem(DEVICE_KEY);
  }
  window.dispatchEvent(new CustomEvent("yetly:ollama-config"));
}

export function clearOllamaConfig() {
  window.sessionStorage.removeItem(SESSION_KEY);
  window.localStorage.removeItem(DEVICE_KEY);
  window.dispatchEvent(new CustomEvent("yetly:ollama-config"));
}

export function onOllamaConfigChange(listener: () => void) {
  window.addEventListener("yetly:ollama-config", listener);
  return () => window.removeEventListener("yetly:ollama-config", listener);
}

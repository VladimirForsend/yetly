import type { OllamaConfig } from "../../features/ai/types";

const SESSION_KEY = "yetly:ollama:session";
const DEVICE_KEY = "yetly:ollama:device";

function parse(raw: string | null): OllamaConfig | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<OllamaConfig>;
    if (typeof value.apiKey !== "string" || !value.apiKey.trim()) return null;
    return {
      apiKey: value.apiKey.trim(),
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
  if (!config.apiKey.trim()) throw new Error("Pega una API key de Ollama.");
  const normalized = { ...config, apiKey: config.apiKey.trim() };
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

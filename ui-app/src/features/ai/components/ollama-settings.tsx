import { Bot, CheckCircle2, ExternalLink, KeyRound, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { clearOllamaConfig, getOllamaConfig, saveOllamaConfig } from "../../../infrastructure/ollama/ollama-config";
import { choosePreferredOllamaModel, listOllamaModels, OllamaApiError, validateOllamaApiKey } from "../../../infrastructure/ollama/ollama-client";
import { Button } from "../../../shared/ui/button";
import type { OllamaModel } from "../types";

export function OllamaSettings() {
  const initial = getOllamaConfig();
  const [apiKey, setApiKey] = useState("");
  const [remember, setRemember] = useState(initial?.remember ?? false);
  const [selectedModel, setSelectedModel] = useState(initial?.defaultModel ?? "");
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState(initial ? "Ollama está configurado en este navegador." : "");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!initial) return;
    void listOllamaModels(initial).then((items) => setModels(items)).catch(() => undefined);
  }, []);

  async function testAndSave() {
    const current = getOllamaConfig();
    const key = apiKey.trim() || current?.apiKey;
    if (!key) return setError("Pega una API key de Ollama.");
    setTesting(true);
    setError("");
    setMessage("");
    try {
      const provisional = { apiKey: key, remember, defaultModel: selectedModel || current?.defaultModel };
      const items = await listOllamaModels(provisional);
      if (!items.length) throw new Error("Ollama no devolvió modelos Gemma disponibles para esta cuenta.");
      let model = choosePreferredOllamaModel(items, selectedModel || current?.defaultModel);
      try {
        await validateOllamaApiKey(provisional, model);
      } catch (cause) {
        const fallbackModel = choosePreferredOllamaModel(items);
        if (cause instanceof OllamaApiError && (cause.status === 401 || cause.status === 403) && fallbackModel && fallbackModel !== model) {
          await validateOllamaApiKey(provisional, fallbackModel);
          model = fallbackModel;
        } else {
          throw cause;
        }
      }
      saveOllamaConfig({ ...provisional, defaultModel: model });
      setModels(items);
      setSelectedModel(model);
      setApiKey("");
      setMessage(`Conexión aprobada. ${items.length} modelo${items.length === 1 ? "" : "s"} disponible${items.length === 1 ? "" : "s"}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos comprobar la conexión.");
    } finally {
      setTesting(false);
    }
  }

  function saveModel(model: string) {
    setSelectedModel(model);
    const current = getOllamaConfig();
    if (current) saveOllamaConfig({ ...current, defaultModel: model, remember });
  }

  function remove() {
    clearOllamaConfig();
    setApiKey("");
    setModels([]);
    setSelectedModel("");
    setMessage("Clave eliminada de este navegador.");
    setError("");
  }

  return (
    <section className="rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 via-white to-blue-50 p-5 shadow-card sm:p-6" aria-labelledby="ollama-settings-heading">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink-950 text-white"><Bot className="h-5 w-5" aria-hidden="true" /></span>
          <div>
            <p className="text-xs font-black uppercase tracking-[.14em] text-brand-700">Yetly AI</p>
            <h2 id="ollama-settings-heading" className="mt-1 text-lg font-black text-ink-950">Ollama Cloud</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-600">La clave queda solamente en este navegador. La función segura de tu Supabase la reenvía a Ollama para evitar el bloqueo de GitHub Pages, sin guardarla en la base de datos ni en respaldos.</p>
          </div>
        </div>
        <a href="https://ollama.com/settings/keys" target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-brand-700 hover:bg-brand-50">
          Crear API key <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(240px,.8fr)]">
        <label>
          <span className="flex items-center gap-2 text-sm font-black text-ink-950"><KeyRound className="h-4 w-4 text-brand-600" /> API key</span>
          <input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} autoComplete="off" placeholder={getOllamaConfig() ? "Clave guardada · pega otra para reemplazar" : "Pega la key o la línea OLLAMA_API_KEY=..."} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" />
        </label>
        <label>
          <span className="text-sm font-black text-ink-950">Modelo predeterminado</span>
          <select value={selectedModel} onChange={(event) => saveModel(event.target.value)} disabled={!models.length} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none disabled:bg-slate-100 focus:border-brand-500 focus:ring-4 focus:ring-brand-100">
            {!models.length && <option value="">Prueba la conexión primero</option>}
            {models.map((model) => <option key={model.model} value={model.model}>{model.name}{model.capabilities.includes("tools") ? " · propuestas" : " · análisis"}</option>)}
          </select>
        </label>
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-600" />
        <span><span className="block text-sm font-black text-ink-900">Recordar en este dispositivo</span><span className="mt-0.5 block text-xs leading-5 text-ink-500">Desmarcado: la clave desaparece al cerrar la sesión del navegador. Marcado: permanece hasta que pulses eliminar.</span></span>
      </label>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button onClick={() => void testAndSave()} disabled={testing}><RefreshCw className={`h-4 w-4 ${testing ? "animate-spin" : ""}`} />{testing ? "Comprobando…" : "Probar y guardar"}</Button>
        {getOllamaConfig() && <Button variant="secondary" onClick={remove} className="text-danger-700"><Trash2 className="h-4 w-4" /> Eliminar clave</Button>}
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-500"><ShieldCheck className="h-4 w-4 text-success-600" /> Los adjuntos binarios no se envían.</span>
      </div>
      {message && <p className="mt-4 flex items-center gap-2 rounded-xl bg-success-50 px-4 py-3 text-sm font-bold text-success-700" role="status"><CheckCircle2 className="h-4 w-4 shrink-0" />{message}</p>}
      {error && <p className="mt-4 rounded-xl bg-danger-50 px-4 py-3 text-sm font-bold text-danger-700" role="alert">{error}</p>}
    </section>
  );
}

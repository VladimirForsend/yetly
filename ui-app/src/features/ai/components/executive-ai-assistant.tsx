import {
  AlertTriangle,
  Bot,
  Check,
  Clipboard,
  KeyRound,
  LoaderCircle,
  Plus,
  Send,
  Sparkles,
  Square,
  WandSparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useWorkspace } from "../../../app/providers/app-providers";
import { getOllamaConfig, onOllamaConfigChange, saveOllamaConfig } from "../../../infrastructure/ollama/ollama-config";
import { listOllamaModels, streamOllamaChat } from "../../../infrastructure/ollama/ollama-client";
import { Button } from "../../../shared/ui/button";
import { buildExecutiveContext, EXECUTIVE_SYSTEM_PROMPT } from "../lib/executive-context";
import { aiHistoryRepository } from "../services/ai-history-repository";
import { applyAiProposal, describeAiAction, ollamaProposalTool, parseAiProposal } from "../services/ai-proposal-service";
import type { AiContextMetadata, AiConversation, AiMessage, AiProposal, AiScope, OllamaConfig, OllamaModel } from "../types";
import { SafeMarkdown } from "./safe-markdown";

const quickActions = [
  { label: "Resumen ejecutivo", prompt: "Entrega un resumen ejecutivo completo del alcance seleccionado, con avance, fechas, esfuerzo, responsables y datos faltantes." },
  { label: "Detectar riesgos", prompt: "Detecta riesgos y troubles del alcance. Ordénalos por severidad y respáldalos con tareas, fechas y cifras concretas." },
  { label: "Plan de recuperación", prompt: "Diseña un plan de recuperación accionable. Si el modelo soporta herramientas, prepara cambios concretos y prudentes para confirmar en Yetly." },
  { label: "Informe semanal", prompt: "Redacta un informe semanal ejecutivo, copiable, con logros, pendientes, riesgos, decisiones y próximos pasos." },
  { label: "Reequilibrar carga", prompt: "Analiza la carga del equipo y sugiere un reequilibrio realista. Prepara cambios confirmables si hay datos suficientes." },
  { label: "Revisar Workflow Nodix", prompt: "Revisa las dependencias del Workflow Nodix, identifica cuellos de botella y propone conexiones o ajustes justificables." },
];

function ProposalCard({ message, scopeProjectId, onChange }: { message: AiMessage; scopeProjectId: string; onChange: (proposal: AiProposal) => Promise<void> }) {
  const { snapshot, createTask, updateTask, updateProject, createWorkflowConnection, deleteWorkflowConnection, saveWorkflowNodePosition } = useWorkspace();
  const proposal = message.proposal!;
  const [selected, setSelected] = useState(() => new Set(proposal.actions.map((action) => action.id)));
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");

  async function apply() {
    if (!snapshot || !selected.size) return;
    setApplying(true);
    setError("");
    try {
      const next = await applyAiProposal({
        proposal,
        selectedActionIds: selected,
        snapshot,
        scopeProjectId,
        dependencies: { createTask, updateTask, updateProject, createWorkflowConnection, deleteWorkflowConnection, saveWorkflowNodePosition },
      });
      await onChange(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos aplicar la propuesta.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-brand-200 bg-brand-50/60" aria-label="Propuesta de cambios de Yetly AI">
      <div className="flex items-start gap-3 border-b border-brand-100 bg-white/70 px-4 py-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-600 text-white"><WandSparkles className="h-4 w-4" /></span>
        <div><p className="text-sm font-black text-ink-950">Propuesta revisable</p><p className="mt-0.5 text-xs leading-5 text-ink-600">{proposal.summary}</p></div>
        <span className="ml-auto rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase text-brand-700">{proposal.status}</span>
      </div>
      <div className="space-y-2 p-3">
        {proposal.actions.map((action) => (
          <label key={action.id} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
            {proposal.status === "pending" && <input type="checkbox" checked={selected.has(action.id)} onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(action.id); else next.delete(action.id); return next; })} className="mt-0.5 h-4 w-4 accent-brand-600" />}
            <span className="text-xs font-bold leading-5 text-ink-700">{snapshot ? describeAiAction(action, snapshot) : action.type}</span>
          </label>
        ))}
        {proposal.results?.map((result) => <p key={result.actionId} className={`rounded-lg px-3 py-2 text-xs font-bold ${result.ok ? "bg-success-50 text-success-700" : "bg-danger-50 text-danger-700"}`}>{result.ok ? "✓" : "×"} {result.message}</p>)}
      </div>
      {proposal.status === "pending" && (
        <div className="flex flex-wrap gap-2 border-t border-brand-100 bg-white/70 px-3 py-3">
          <Button onClick={() => void apply()} disabled={applying || !selected.size}><Check className="h-4 w-4" />{applying ? "Aplicando…" : `Confirmar ${selected.size} cambio${selected.size === 1 ? "" : "s"}`}</Button>
          <Button variant="secondary" onClick={() => void onChange({ ...proposal, status: "discarded" })} disabled={applying}><X className="h-4 w-4" /> Descartar propuesta</Button>
        </div>
      )}
      {error && <p className="m-3 rounded-lg bg-danger-50 px-3 py-2 text-xs font-bold text-danger-700">{error}</p>}
    </section>
  );
}

export function ExecutiveAiAssistant() {
  const workspace = useWorkspace();
  const { snapshot } = workspace;
  const [config, setConfig] = useState<OllamaConfig | null>(() => getOllamaConfig());
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [model, setModel] = useState(config?.defaultModel ?? "");
  const [scopeType, setScopeType] = useState<AiScope["type"]>("project");
  const [projectId, setProjectId] = useState(snapshot?.projects[0]?.id ?? "");
  const [taskId, setTaskId] = useState("");
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>();
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [body, setBody] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [metadata, setMetadata] = useState<AiContextMetadata>();
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController>();

  useEffect(() => onOllamaConfigChange(() => {
    const next = getOllamaConfig();
    setConfig(next);
    setModel(next?.defaultModel ?? "");
  }), []);

  useEffect(() => {
    if (!snapshot?.projects.length) return;
    if (!snapshot.projects.some((project) => project.id === projectId)) setProjectId(snapshot.projects[0].id);
  }, [snapshot?.projects, projectId]);

  const projectTasks = useMemo(() => snapshot?.tasks.filter((task) => task.projectId === projectId) ?? [], [snapshot?.tasks, projectId]);
  useEffect(() => {
    if (scopeType === "task" && !projectTasks.some((task) => task.id === taskId)) setTaskId(projectTasks[0]?.id ?? "");
  }, [scopeType, projectTasks, taskId]);

  const scope = useMemo<AiScope | undefined>(() => projectId && (scopeType === "project" || taskId)
    ? { type: scopeType, projectId, taskId: scopeType === "task" ? taskId : undefined }
    : undefined, [scopeType, projectId, taskId]);

  useEffect(() => {
    if (!config) { setModels([]); return; }
    let cancelled = false;
    setLoadingModels(true);
    setError("");
    void listOllamaModels(config).then((items) => {
      if (cancelled) return;
      setModels(items);
      const next = items.some((item) => item.model === (config.defaultModel ?? model)) ? (config.defaultModel ?? model) : items[0]?.model ?? "";
      setModel(next);
    }).catch((cause) => !cancelled && setError(cause instanceof Error ? cause.message : "No pudimos listar los modelos.")).finally(() => !cancelled && setLoadingModels(false));
    return () => { cancelled = true; };
  }, [config?.apiKey]);

  useEffect(() => {
    if (!snapshot || !scope) return;
    let cancelled = false;
    setLoadingHistory(true);
    setMessages([]);
    setActiveConversationId(undefined);
    void aiHistoryRepository.listConversations(snapshot.activeOrganization.id, snapshot.currentUser.id, scope).then(async (items) => {
      if (cancelled) return;
      setConversations(items);
      const active = items[0];
      if (!active) return;
      setActiveConversationId(active.id);
      const saved = await aiHistoryRepository.listMessages(active.id, snapshot.currentUser.id);
      if (!cancelled) setMessages(saved);
    }).catch((cause) => !cancelled && setError(cause instanceof Error ? cause.message : "No pudimos cargar el historial.")).finally(() => !cancelled && setLoadingHistory(false));
    return () => { cancelled = true; };
  }, [snapshot?.activeOrganization.id, snapshot?.currentUser.id, scope?.type, scope?.projectId, scope?.taskId]);

  const selectedModel = models.find((item) => item.model === model);
  const supportsTools = selectedModel?.capabilities.includes("tools") ?? false;

  async function selectConversation(conversationId: string) {
    if (!snapshot) return;
    setActiveConversationId(conversationId);
    setLoadingHistory(true);
    try { setMessages(await aiHistoryRepository.listMessages(conversationId, snapshot.currentUser.id)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No pudimos abrir la conversación."); }
    finally { setLoadingHistory(false); }
  }

  function selectModel(value: string) {
    setModel(value);
    if (config) {
      const next = { ...config, defaultModel: value };
      saveOllamaConfig(next);
      setConfig(next);
    }
  }

  async function send(prompt = body) {
    if (!snapshot || !scope || !config || !model || !prompt.trim() || sending) return;
    setSending(true);
    setError("");
    setStreamingText("");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const context = buildExecutiveContext(snapshot, scope);
      setMetadata(context.metadata);
      let conversation = conversations.find((item) => item.id === activeConversationId);
      if (!conversation) {
        const project = snapshot.projects.find((item) => item.id === scope.projectId)!;
        const task = scope.taskId ? snapshot.tasks.find((item) => item.id === scope.taskId) : undefined;
        conversation = await aiHistoryRepository.createConversation({
          organizationId: snapshot.activeOrganization.id,
          userId: snapshot.currentUser.id,
          scope,
          title: task?.title ?? project.name,
          model,
        });
        setConversations((current) => [conversation!, ...current]);
        setActiveConversationId(conversation.id);
      }
      const userMessage = await aiHistoryRepository.addMessage({
        conversationId: conversation.id,
        organizationId: snapshot.activeOrganization.id,
        userId: snapshot.currentUser.id,
        role: "user",
        content: prompt.trim(),
      });
      const history = [...messages, userMessage].slice(-12).map((message) => ({ role: message.role, content: message.content }));
      setMessages((current) => [...current, userMessage]);
      setBody("");
      const result = await streamOllamaChat({
        config,
        model,
        signal: controller.signal,
        onContent: setStreamingText,
        tools: supportsTools ? [ollamaProposalTool] : undefined,
        messages: [
          { role: "system", content: `${EXECUTIVE_SYSTEM_PROMPT}\n\nPara conexiones nuevas puedes usar el clientRef de una tarea propuesta. Usa siempre IDs exactos incluidos en los datos.` },
          { role: "system", content: `YETLY_DATA\n${context.serialized}\nEND_YETLY_DATA` },
          ...history,
        ],
      });
      const proposalCall = result.toolCalls.find((call) => call.name === "propose_yetly_changes");
      const proposal = proposalCall ? parseAiProposal(proposalCall.arguments) : undefined;
      const content = result.content.trim() || (proposal ? "Preparé una propuesta de cambios basada en el análisis. Revísala antes de confirmar." : "Ollama no devolvió contenido.");
      const assistantMessage = await aiHistoryRepository.addMessage({
        conversationId: conversation.id,
        organizationId: snapshot.activeOrganization.id,
        userId: snapshot.currentUser.id,
        role: "assistant",
        content,
        model,
        usage: result.usage,
        proposal,
      });
      setMessages((current) => [...current, assistantMessage]);
      setStreamingText("");
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") setError("Generación cancelada.");
      else setError(cause instanceof Error ? cause.message : "No pudimos completar el análisis.");
    } finally {
      setSending(false);
      abortRef.current = undefined;
    }
  }

  async function updateProposal(message: AiMessage, proposal: AiProposal) {
    if (!snapshot) return;
    await aiHistoryRepository.updateProposal(message.id, snapshot.currentUser.id, proposal, proposal.status);
    setMessages((current) => current.map((item) => item.id === message.id ? { ...item, proposal } : item));
    workspace.refetch();
  }

  if (!snapshot) return null;

  if (!snapshot.projects.length) {
    return <section className="rounded-2xl border border-brand-100 bg-gradient-to-r from-brand-50 via-white to-blue-50 p-5 sm:p-6"><div className="flex items-center gap-3"><Bot className="h-5 w-5 text-brand-700" /><div><h2 className="font-black text-ink-950">Yetly AI está listo</h2><p className="mt-1 text-sm text-ink-600">Crea un proyecto para comenzar el análisis ejecutivo.</p></div></div></section>;
  }

  if (!config) {
    return (
      <section className="rounded-2xl border border-brand-200 bg-gradient-to-r from-brand-50 via-white to-blue-50 p-5 sm:p-6" aria-labelledby="confidence-heading">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink-950 text-white"><Sparkles className="h-5 w-5" /></span><div><p className="text-xs font-black uppercase tracking-[.14em] text-brand-700">Yetly AI</p><h2 id="confidence-heading" className="mt-1 font-black text-ink-950">Convierte tus proyectos en decisiones</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-ink-600">Conecta una API key personal de Ollama Cloud para obtener resúmenes, riesgos, proyecciones y propuestas confirmables.</p></div></div>
          <Link to="/settings" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 font-semibold text-white shadow-sm hover:bg-brand-700"><KeyRound className="h-4 w-4" /> Configurar Ollama</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-brand-200 bg-white shadow-card" aria-labelledby="confidence-heading">
      <div className="bg-gradient-to-r from-brand-50 via-white to-blue-50 p-5 sm:p-6">
        <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink-950 text-white"><Sparkles className="h-5 w-5" /></span><div><p className="text-xs font-black uppercase tracking-[.14em] text-brand-700">Yetly AI · Ollama Cloud</p><h2 id="confidence-heading" className="mt-1 text-lg font-black text-ink-950">Análisis ejecutivo con contexto real</h2><p className="mt-1 text-sm leading-6 text-ink-600">Selecciona un proyecto o tarea. Yetly enviará una fotografía actual de sus datos, nunca los archivos adjuntos.</p></div></div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label><span className="text-xs font-black text-ink-600">Proyecto</span><select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100">{snapshot.projects.map((project) => <option key={project.id} value={project.id}>{project.code} · {project.name}</option>)}</select></label>
          <label><span className="text-xs font-black text-ink-600">Alcance</span><select value={scopeType} onChange={(event) => setScopeType(event.target.value as AiScope["type"])} className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"><option value="project">Proyecto completo</option><option value="task">Tarea específica</option></select></label>
          {scopeType === "task" ? <label><span className="text-xs font-black text-ink-600">Tarea</span><select value={taskId} onChange={(event) => setTaskId(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100">{projectTasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label> : <div className="hidden xl:block" />}
          <label><span className="text-xs font-black text-ink-600">Modelo</span><select value={model} onChange={(event) => selectModel(event.target.value)} disabled={loadingModels || !models.length} className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold outline-none disabled:bg-slate-100 focus:border-brand-500 focus:ring-4 focus:ring-brand-100">{loadingModels && <option>Cargando modelos…</option>}{models.map((item) => <option key={item.model} value={item.model}>{item.name}{item.capabilities.includes("tools") ? " · propuestas" : " · análisis"}</option>)}</select></label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">{quickActions.map((action) => <button key={action.label} onClick={() => void send(action.prompt)} disabled={sending || !model || (scopeType === "task" && !taskId)} className="rounded-full border border-brand-200 bg-white px-3 py-2 text-xs font-black text-brand-700 hover:bg-brand-50 disabled:opacity-50">{action.label}</button>)}</div>
        <p className="mt-3 text-xs font-semibold text-ink-500">{supportsTools ? "Este modelo puede preparar cambios confirmables." : "Este modelo realiza análisis. Para propuestas aplicables, elige uno marcado como “propuestas”."}</p>
      </div>

      <div className="grid min-h-[430px] lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-slate-50 p-3 lg:border-b-0 lg:border-r" aria-label="Conversaciones privadas de IA">
          <Button variant="secondary" className="w-full" onClick={() => { setActiveConversationId(undefined); setMessages([]); }}><Plus className="h-4 w-4" /> Nueva conversación</Button>
          <div className="mt-3 space-y-1">{conversations.slice(0, 12).map((conversation) => <button key={conversation.id} onClick={() => void selectConversation(conversation.id)} className={`w-full rounded-xl px-3 py-2.5 text-left ${conversation.id === activeConversationId ? "bg-brand-600 text-white" : "text-ink-700 hover:bg-white"}`}><span className="block truncate text-xs font-black">{conversation.title}</span><span className="mt-0.5 block truncate text-[10px] opacity-70">{new Date(conversation.updatedAt).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}</span></button>)}</div>
          {!conversations.length && <p className="mt-5 px-2 text-center text-xs leading-5 text-ink-500">Tus conversaciones privadas aparecerán aquí.</p>}
        </aside>

        <div className="flex min-w-0 flex-col bg-white">
          <div className="max-h-[520px] min-h-[320px] flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
            {loadingHistory && <div className="grid min-h-48 place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-brand-600" /></div>}
            {!loadingHistory && !messages.length && !streamingText && <div className="grid min-h-64 place-items-center text-center"><div><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Bot className="h-7 w-7" /></span><h3 className="mt-4 font-black text-ink-950">¿Qué necesitas decidir?</h3><p className="mt-1 max-w-md text-sm leading-6 text-ink-500">Usa una acción rápida o pregunta por fechas, riesgos, carga, esfuerzo y dependencias.</p></div></div>}
            {messages.map((message) => <article key={message.id} className={`rounded-2xl p-4 ${message.role === "user" ? "ml-auto max-w-[86%] bg-brand-600 text-white" : "mr-auto max-w-[96%] border border-slate-200 bg-slate-50"}`}><p className={`mb-2 text-[10px] font-black uppercase tracking-wider ${message.role === "user" ? "text-white/70" : "text-brand-700"}`}>{message.role === "user" ? "Tú" : `Yetly AI${message.model ? ` · ${message.model}` : ""}`}</p>{message.role === "assistant" ? <SafeMarkdown content={message.content} /> : <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>}{message.proposal && scope && <ProposalCard message={message} scopeProjectId={scope.projectId} onChange={(proposal) => updateProposal(message, proposal)} />}{message.role === "assistant" && <button onClick={() => void navigator.clipboard.writeText(message.content)} className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-black text-brand-700"><Clipboard className="h-3.5 w-3.5" /> Copiar respuesta</button>}</article>)}
            {streamingText && <article className="mr-auto max-w-[96%] rounded-2xl border border-brand-200 bg-brand-50 p-4"><p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-brand-700"><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Yetly AI está analizando</p><SafeMarkdown content={streamingText} /></article>}
          </div>
          {metadata && <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-[10px] font-semibold text-ink-500"><span className="font-black">Datos usados:</span> {metadata.includedTasks} tarea{metadata.includedTasks === 1 ? "" : "s"}, adjuntos solo como metadatos · captura {new Date(metadata.capturedAt).toLocaleString("es-CL")}{metadata.omittedTasks ? ` · ${metadata.omittedTasks} tareas omitidas por límite` : ""}</div>}
          {error && <div className="mx-4 mt-3 flex items-start gap-2 rounded-xl bg-danger-50 px-3 py-2.5 text-xs font-bold text-danger-700" role="alert"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
          <form onSubmit={(event) => { event.preventDefault(); void send(); }} className="flex gap-2 border-t border-slate-200 p-3 sm:p-4">
            <label className="min-w-0 flex-1"><span className="sr-only">Pregunta para Yetly AI</span><textarea value={body} onChange={(event) => setBody(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} rows={2} placeholder="Pregunta por este proyecto o tarea…" className="w-full resize-none rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" /></label>
            {sending ? <button type="button" onClick={() => abortRef.current?.abort()} className="grid h-12 w-12 place-items-center self-end rounded-xl bg-danger-600 text-white" aria-label="Cancelar respuesta"><Square className="h-4 w-4" /></button> : <button disabled={!body.trim() || !model || (scopeType === "task" && !taskId)} className="grid h-12 w-12 place-items-center self-end rounded-xl bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40" aria-label="Enviar pregunta"><Send className="h-5 w-5" /></button>}
          </form>
        </div>
      </div>
    </section>
  );
}

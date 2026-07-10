import * as Dialog from "@radix-ui/react-dialog";
import { CalendarDays, CheckSquare, Clock3, Download, FileText, Flag, History, MessageCircle, Paperclip, Play, Plus, RefreshCw, Save, Trash2, Users, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Priority, TaskMode, TaskStatus, TaskSummary } from "../../../application/ports/workspace-port";
import { useWorkspace } from "../../../app/providers/app-providers";
import { formatMinutes } from "../../../shared/lib/format";
import { Avatar } from "../../../shared/ui/avatar";
import { Button } from "../../../shared/ui/button";

const statusOptions: Array<{ value: TaskStatus; label: string }> = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "Por hacer" },
  { value: "in_progress", label: "En curso" },
  { value: "review", label: "Revisión" },
  { value: "done", label: "Completada" },
];

const priorityOptions: Array<{ value: Priority; label: string }> = [
  { value: "low", label: "Baja" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

export function TaskDrawer({
  task,
  open,
  onOpenChange,
}: {
  task?: TaskSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const {
    updateTask, deleteTask, startTimer, snapshot, isMutating, addTaskMessage,
    addChecklistItem, setChecklistItemCompleted, deleteChecklistItem,
    uploadTaskAttachment, replaceTaskAttachment, downloadTaskAttachment, deleteTaskAttachment,
  } = useWorkspace();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<Priority>("normal");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [estimateHours, setEstimateHours] = useState("0");
  const [assigneeId, setAssigneeId] = useState("");
  const [mode, setMode] = useState<TaskMode>("standard");
  const [checklistText, setChecklistText] = useState("");
  const [messageText, setMessageText] = useState("");
  const [busySection, setBusySection] = useState(false);
  const replacementTarget = useRef<string>();
  const uploadInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description ?? "");
    setStatus(task.status);
    setPriority(task.priority);
    setStartDate(task.startDate ?? "");
    setDueDate(task.dueDate ?? "");
    setEstimateHours(String(task.estimateMinutes / 60));
    setAssigneeId(task.assignees[0]?.id ?? "");
    setMode(task.mode);
    setError("");
    setSuccess("");
  }, [task]);

  if (!task) return null;
  const currentTask = task;

  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    try {
      await updateTask(currentTask.id, {
        title,
        description,
        status,
        priority,
        startDate,
        dueDate,
        estimateMinutes: Math.max(0, Math.round(Number(estimateHours || 0) * 60)),
        assigneeId,
        mode,
      });
      setSuccess("Cambios guardados.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible guardar.");
    }
  }

  async function remove() {
    const confirmed = window.confirm(`¿Eliminar la tarea "${currentTask.title}"? También se eliminarán sus registros de tiempo asociados.`);
    if (!confirmed) return;
    setError("");
    try {
      await deleteTask(currentTask.id);
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible eliminar.");
    }
  }

  async function start() {
    setError("");
    try {
      await startTimer(currentTask.id);
      setSuccess("Timer iniciado. Puedes detenerlo desde la barra superior.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible iniciar el timer.");
    }
  }

  async function runSection(action: () => Promise<void>, successMessage?: string) {
    setError("");
    setSuccess("");
    setBusySection(true);
    try {
      await action();
      if (successMessage) setSuccess(successMessage);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible completar la acción.");
    } finally {
      setBusySection(false);
    }
  }

  async function sendTaskMessage() {
    if (!messageText.trim()) return;
    await runSection(async () => {
      await addTaskMessage(currentTask.id, messageText);
      setMessageText("");
    });
  }

  async function addCheckItem() {
    if (!checklistText.trim()) return;
    await runSection(async () => {
      await addChecklistItem(currentTask.id, checklistText);
      setChecklistText("");
    });
  }

  async function handleUpload(file?: File) {
    if (!file) return;
    await runSection(() => uploadTaskAttachment(currentTask.id, file), "Adjunto disponible para el equipo y guardado en este navegador.");
    if (uploadInput.current) uploadInput.current.value = "";
  }

  async function handleReplacement(file?: File) {
    const attachmentId = replacementTarget.current;
    if (!file || !attachmentId) return;
    await runSection(() => replaceTaskAttachment(attachmentId, file), "Adjunto actualizado y versión registrada.");
    replacementTarget.current = undefined;
    if (replaceInput.current) replaceInput.current.value = "";
  }

  async function downloadAttachment(attachmentId: string) {
    await runSection(async () => {
      const { blob, fileName } = await downloadTaskAttachment(attachmentId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    }, "Archivo descargado y guardado localmente en este navegador.");
  }

  const timerIsThisTask = snapshot?.activeTimer?.taskId === task.id;
  const canEdit = task.canEdit;
  const isAdmin = snapshot?.activeOrganization.memberRole === "owner" || snapshot?.activeOrganization.memberRole === "admin";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-ink-950/30" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-[90] w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white shadow-float focus:outline-none" aria-describedby="task-drawer-description">
          <form className="min-h-full" onSubmit={save}>
            <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-7">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-brand-600">{task.projectCode} · Editar tarea</p>
                  <Dialog.Title className="mt-1 text-xl font-black tracking-[-0.03em] text-ink-950">Detalle operativo</Dialog.Title>
                  <Dialog.Description id="task-drawer-description" className="mt-1 text-xs text-ink-500">Los cambios se persisten al guardar.</Dialog.Description>
                </div>
                <Dialog.Close asChild>
                  <button className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-ink-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200" aria-label="Cerrar detalle de tarea">
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                </Dialog.Close>
              </div>
            </header>

            <div className="space-y-6 px-5 py-6 sm:px-7">
              <label className="block">
                <span className="text-sm font-black text-ink-900">Título</span>
                <input value={title} onChange={(event) => setTitle(event.target.value)} required minLength={2} disabled={!canEdit} className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-ink-500" />
              </label>

              <label className="block">
                <span className="text-sm font-black text-ink-900">Descripción</span>
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} disabled={!canEdit} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm leading-6 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-ink-500" placeholder="Contexto, criterios de aceptación o notas…" />
              </label>

              <section className="rounded-2xl border border-brand-100 bg-brand-50/50 p-4" aria-labelledby="task-mode-heading">
                <h2 id="task-mode-heading" className="text-sm font-black text-ink-950">Tipo de tarea</h2>
                <p className="mt-1 text-xs leading-5 text-ink-500">Puedes cambiar el modo sin perder mensajes, checklist, adjuntos ni historial.</p>
                <select value={mode} onChange={(event) => setMode(event.target.value as TaskMode)} disabled={!canEdit} className="mt-3 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100 disabled:bg-slate-50">
                  <option value="standard">Tarea normal</option>
                  <option value="checklist">Listado de checklist</option>
                  <option value="message">Mensaje de tarea</option>
                </select>
                <label className="mt-3 flex items-center gap-3 text-sm font-bold text-ink-800">
                  <input type="checkbox" checked={mode === "message"} disabled={!canEdit} onChange={(event) => setMode(event.target.checked ? "message" : "standard")} className="h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                  Mensaje de tarea
                </label>
              </section>

              {!canEdit && (
                <p className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
                  Como responsable puedes conversar, marcar el checklist y descargar adjuntos. Solo quien creó la tarea o un administrador puede modificar sus campos.
                </p>
              )}

              <section aria-labelledby="task-fields-heading">
                <h2 id="task-fields-heading" className="sr-only">Campos de la tarea</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="flex items-center gap-2 text-xs font-black text-ink-600"><Flag className="h-4 w-4" aria-hidden="true" /> Prioridad</span>
                    <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)} disabled={!canEdit} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100 disabled:bg-slate-50">
                      {priorityOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="flex items-center gap-2 text-xs font-black text-ink-600"><Flag className="h-4 w-4" aria-hidden="true" /> Estado</span>
                    <select value={status} onChange={(event) => setStatus(event.target.value as TaskStatus)} disabled={!canEdit} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100 disabled:bg-slate-50">
                      {statusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="flex items-center gap-2 text-xs font-black text-ink-600"><CalendarDays className="h-4 w-4" aria-hidden="true" /> Inicio</span>
                    <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} disabled={!canEdit} className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100 disabled:bg-slate-50" />
                  </label>
                  <label className="block">
                    <span className="flex items-center gap-2 text-xs font-black text-ink-600"><CalendarDays className="h-4 w-4" aria-hidden="true" /> Fecha límite</span>
                    <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} disabled={!canEdit} className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100 disabled:bg-slate-50" />
                  </label>
                  <label className="block">
                    <span className="flex items-center gap-2 text-xs font-black text-ink-600"><Clock3 className="h-4 w-4" aria-hidden="true" /> Estimación (h)</span>
                    <input type="number" min="0" step="0.25" value={estimateHours} onChange={(event) => setEstimateHours(event.target.value)} disabled={!canEdit} className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100 disabled:bg-slate-50" />
                  </label>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <span className="flex items-center gap-2 text-xs font-black text-ink-600"><Clock3 className="h-4 w-4" aria-hidden="true" /> Tiempo real</span>
                    <p className="mt-2 text-sm font-black text-ink-950">{formatMinutes(task.actualMinutes)}</p>
                  </div>
                </div>
              </section>

              <section aria-labelledby="assignees-heading">
                <h2 id="assignees-heading" className="flex items-center gap-2 text-sm font-black text-ink-950"><Users className="h-4 w-4 text-ink-500" aria-hidden="true" /> Responsable</h2>
                <label className="mt-3 block">
                  <span className="sr-only">Seleccionar responsable</span>
                  <select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} disabled={!canEdit} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100 disabled:bg-slate-50">
                    <option value="">Sin responsable</option>
                    {(snapshot?.workload ?? []).map(({ person }) => <option key={person.id} value={person.id}>{person.name} · {person.role}</option>)}
                  </select>
                </label>
                {task.assignees.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {task.assignees.map((person) => (
                      <span key={person.id} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1.5 pl-1.5 pr-3 text-sm font-semibold text-ink-700">
                        <Avatar person={person} size="sm" /> {person.name}
                      </span>
                    ))}
                  </div>
                )}
              </section>

              {mode === "checklist" && (
                <section className="rounded-2xl border border-slate-200 p-4" aria-labelledby="checklist-heading">
                  <h2 id="checklist-heading" className="flex items-center gap-2 text-sm font-black text-ink-950"><CheckSquare className="h-4 w-4 text-brand-600" /> Checklist</h2>
                  <div className="mt-3 space-y-2">
                    {task.checklist.length ? task.checklist.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                        <input type="checkbox" checked={item.completed} disabled={busySection} onChange={(event) => void runSection(() => setChecklistItemCompleted(item.id, event.target.checked))} className="h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                        <span className={`min-w-0 flex-1 text-sm font-semibold ${item.completed ? "text-ink-400 line-through" : "text-ink-800"}`}>{item.text}</span>
                        {(item.createdBy === snapshot?.currentUser.id || isAdmin) && <button type="button" onClick={() => void runSection(() => deleteChecklistItem(item.id))} className="rounded-lg p-2 text-ink-400 hover:bg-danger-50 hover:text-danger-700" aria-label={`Eliminar ${item.text}`}><Trash2 className="h-4 w-4" /></button>}
                      </div>
                    )) : <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-sm text-ink-500">Aún no hay elementos.</p>}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <input value={checklistText} onChange={(event) => setChecklistText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void addCheckItem(); } }} placeholder="Añadir elemento…" className="h-11 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" />
                    <Button type="button" onClick={() => void addCheckItem()} disabled={busySection || !checklistText.trim()}><Plus className="h-4 w-4" /> Añadir</Button>
                  </div>
                </section>
              )}

              <section className={`rounded-2xl border p-4 ${mode === "message" ? "border-brand-200 bg-brand-50/40" : "border-slate-200"}`} aria-labelledby="task-messages-heading">
                <h2 id="task-messages-heading" className="flex items-center gap-2 text-sm font-black text-ink-950"><MessageCircle className="h-4 w-4 text-brand-600" /> Mensajes de tarea</h2>
                <div className="mt-3 max-h-64 space-y-3 overflow-y-auto pr-1">
                  {task.messages.length ? task.messages.map((message) => (
                    <article key={message.id} className={`rounded-xl px-3 py-2.5 ${message.author.id === snapshot?.currentUser.id ? "ml-8 bg-brand-600 text-white" : "mr-8 bg-slate-100 text-ink-900"}`}>
                      <div className="flex items-center justify-between gap-3 text-[11px] font-bold opacity-75"><span>{message.author.name}</span><time>{new Date(message.createdAt).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}</time></div>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-5">{message.body}</p>
                    </article>
                  )) : <p className="rounded-xl bg-white/70 px-3 py-4 text-center text-sm text-ink-500">Usa este espacio para coordinar la tarea sin modificarla.</p>}
                </div>
                <div className="mt-3 flex gap-2">
                  <textarea value={messageText} onChange={(event) => setMessageText(event.target.value)} rows={2} placeholder="Escribe un mensaje de tarea…" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" />
                  <Button type="button" onClick={() => void sendTaskMessage()} disabled={busySection || !messageText.trim()}>Enviar</Button>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 p-4" aria-labelledby="attachments-heading">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 id="attachments-heading" className="flex items-center gap-2 text-sm font-black text-ink-950"><Paperclip className="h-4 w-4 text-brand-600" /> Adjuntos</h2>
                    <p className="mt-1 text-xs text-ink-500">Máximo 50 MB. La descarga se conserva en este navegador.</p>
                  </div>
                  <Button type="button" variant="secondary" onClick={() => uploadInput.current?.click()} disabled={busySection}><Plus className="h-4 w-4" /> Adjuntar</Button>
                </div>
                <input ref={uploadInput} type="file" className="hidden" onChange={(event) => void handleUpload(event.target.files?.[0])} />
                <input ref={replaceInput} type="file" className="hidden" onChange={(event) => void handleReplacement(event.target.files?.[0])} />
                <div className="mt-3 space-y-2">
                  {task.attachments.length ? task.attachments.map((attachment) => {
                    const mayManage = attachment.uploadedBy.id === snapshot?.currentUser.id || isAdmin;
                    return (
                      <div key={attachment.id} className={`rounded-xl border px-3 py-3 ${attachment.deletedAt ? "border-slate-100 bg-slate-50 opacity-60" : "border-slate-200 bg-white"}`}>
                        <div className="flex items-start gap-3">
                          <FileText className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
                          <div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-ink-900">{attachment.fileName}</p><p className="mt-0.5 text-xs text-ink-500">v{attachment.version} · {(attachment.sizeBytes / 1024).toFixed(1)} KB · {attachment.uploadedBy.name}{attachment.cachedLocally ? " · copia local" : ""}</p></div>
                        </div>
                        {!attachment.deletedAt ? <div className="mt-2 flex flex-wrap gap-2 pl-8">
                          <button type="button" onClick={() => void downloadAttachment(attachment.id)} disabled={busySection} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold text-brand-700 hover:bg-brand-50"><Download className="h-3.5 w-3.5" /> Descargar</button>
                          {mayManage && <button type="button" onClick={() => { replacementTarget.current = attachment.id; replaceInput.current?.click(); }} disabled={busySection} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold text-ink-600 hover:bg-slate-100"><RefreshCw className="h-3.5 w-3.5" /> Reemplazar</button>}
                          {mayManage && <button type="button" onClick={() => void runSection(() => deleteTaskAttachment(attachment.id))} disabled={busySection} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold text-danger-700 hover:bg-danger-50"><Trash2 className="h-3.5 w-3.5" /> Eliminar</button>}
                        </div> : <p className="mt-2 pl-8 text-xs font-bold text-danger-700">Archivo eliminado; la acción permanece en el historial.</p>}
                      </div>
                    );
                  }) : <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-sm text-ink-500">Sin adjuntos.</p>}
                </div>
              </section>

              <details className="rounded-2xl border border-slate-200 p-4">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-black text-ink-950"><History className="h-4 w-4 text-brand-600" /> Historial de acciones <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs text-ink-500">{task.history.length}</span></summary>
                <ol className="mt-4 space-y-3 border-l border-slate-200 pl-4">
                  {task.history.length ? task.history.map((event) => <li key={event.id}><p className="text-sm font-bold text-ink-900">{event.action}</p><p className="text-xs text-ink-500">{event.actor.name} · {new Date(event.createdAt).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}</p>{event.detail && <p className="mt-1 text-xs text-ink-600">{event.detail}</p>}</li>) : <li className="text-sm text-ink-500">Aún no hay acciones registradas.</li>}
                </ol>
              </details>

              {error && <p className="rounded-xl bg-danger-50 px-4 py-3 text-sm font-bold text-danger-700" role="alert">{error}</p>}
              {success && <p className="rounded-xl bg-success-50 px-4 py-3 text-sm font-bold text-success-700" role="status" aria-live="polite">{success}</p>}

              <div className="grid gap-3 sm:grid-cols-2">
                <Button type="button" variant="secondary" onClick={() => void start()} disabled={isMutating || Boolean(snapshot?.activeTimer)}>
                  <Play className="h-4 w-4" aria-hidden="true" /> {timerIsThisTask ? "Timer activo" : snapshot?.activeTimer ? "Hay otro timer activo" : "Iniciar timer"}
                </Button>
                {canEdit ? <Button type="submit" disabled={isMutating}><Save className="h-4 w-4" aria-hidden="true" /> Guardar cambios</Button> : <Button type="button" disabled variant="secondary">Edición restringida</Button>}
              </div>

              {canEdit && <div className="border-t border-slate-100 pt-5">
                <Button type="button" variant="secondary" onClick={() => void remove()} disabled={isMutating} className="text-danger-700 hover:bg-danger-50">
                  <Trash2 className="h-4 w-4" aria-hidden="true" /> Eliminar tarea
                </Button>
              </div>}
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

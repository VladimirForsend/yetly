import * as Dialog from "@radix-ui/react-dialog";
import { CalendarDays, Clock3, Flag, Play, Save, Trash2, Users, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import type { Priority, TaskStatus, TaskSummary } from "../../../application/ports/workspace-port";
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
  const { updateTask, deleteTask, startTimer, snapshot, isMutating } = useWorkspace();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<Priority>("normal");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [estimateHours, setEstimateHours] = useState("0");
  const [assigneeId, setAssigneeId] = useState("");
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

  const timerIsThisTask = snapshot?.activeTimer?.taskId === task.id;

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
                <input value={title} onChange={(event) => setTitle(event.target.value)} required minLength={2} className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" />
              </label>

              <label className="block">
                <span className="text-sm font-black text-ink-900">Descripción</span>
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm leading-6 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" placeholder="Contexto, criterios de aceptación o notas…" />
              </label>

              <section aria-labelledby="task-fields-heading">
                <h2 id="task-fields-heading" className="sr-only">Campos de la tarea</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="flex items-center gap-2 text-xs font-black text-ink-600"><Flag className="h-4 w-4" aria-hidden="true" /> Prioridad</span>
                    <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100">
                      {priorityOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="flex items-center gap-2 text-xs font-black text-ink-600"><Flag className="h-4 w-4" aria-hidden="true" /> Estado</span>
                    <select value={status} onChange={(event) => setStatus(event.target.value as TaskStatus)} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100">
                      {statusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="flex items-center gap-2 text-xs font-black text-ink-600"><CalendarDays className="h-4 w-4" aria-hidden="true" /> Inicio</span>
                    <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" />
                  </label>
                  <label className="block">
                    <span className="flex items-center gap-2 text-xs font-black text-ink-600"><CalendarDays className="h-4 w-4" aria-hidden="true" /> Fecha límite</span>
                    <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" />
                  </label>
                  <label className="block">
                    <span className="flex items-center gap-2 text-xs font-black text-ink-600"><Clock3 className="h-4 w-4" aria-hidden="true" /> Estimación (h)</span>
                    <input type="number" min="0" step="0.25" value={estimateHours} onChange={(event) => setEstimateHours(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" />
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
                  <select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100">
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

              {error && <p className="rounded-xl bg-danger-50 px-4 py-3 text-sm font-bold text-danger-700" role="alert">{error}</p>}
              {success && <p className="rounded-xl bg-success-50 px-4 py-3 text-sm font-bold text-success-700" role="status" aria-live="polite">{success}</p>}

              <div className="grid gap-3 sm:grid-cols-2">
                <Button type="button" variant="secondary" onClick={() => void start()} disabled={isMutating || Boolean(snapshot?.activeTimer)}>
                  <Play className="h-4 w-4" aria-hidden="true" /> {timerIsThisTask ? "Timer activo" : snapshot?.activeTimer ? "Hay otro timer activo" : "Iniciar timer"}
                </Button>
                <Button type="submit" disabled={isMutating}><Save className="h-4 w-4" aria-hidden="true" /> Guardar cambios</Button>
              </div>

              <div className="border-t border-slate-100 pt-5">
                <Button type="button" variant="secondary" onClick={() => void remove()} disabled={isMutating} className="text-danger-700 hover:bg-danger-50">
                  <Trash2 className="h-4 w-4" aria-hidden="true" /> Eliminar tarea
                </Button>
              </div>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

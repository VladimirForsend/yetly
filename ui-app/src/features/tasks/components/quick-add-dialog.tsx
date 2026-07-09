import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { Priority, TaskStatus } from "../../../application/ports/workspace-port";
import { useWorkspace } from "../../../app/providers/app-providers";
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

export function QuickAddDialog({ compact = false, defaultProjectId = "" }: { compact?: boolean; defaultProjectId?: string }) {
  const { snapshot, createTask, isCreatingTask } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState(defaultProjectId);
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<Priority>("normal");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [estimateHours, setEstimateHours] = useState("1");
  const [assigneeId, setAssigneeId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const projects = useMemo(
    () => snapshot?.projects.filter((project) => project.status !== "completed") ?? [],
    [snapshot?.projects],
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (title.trim().length < 3) {
      setError("Escribe un título de al menos 3 caracteres.");
      return;
    }
    if (!projectId) {
      setError("Selecciona el proyecto donde se creará la tarea.");
      return;
    }
    if (startDate && dueDate && dueDate < startDate) {
      setError("La fecha límite no puede ser anterior al inicio.");
      return;
    }

    try {
      const hours = Number(estimateHours);
      await createTask({
        projectId,
        title,
        description,
        status,
        priority,
        startDate: startDate || undefined,
        dueDate: dueDate || undefined,
        estimateMinutes: Number.isFinite(hours) ? Math.max(0, Math.round(hours * 60)) : 0,
        assigneeId: assigneeId || snapshot?.currentUser.id,
      });
      setSuccess("Tarea creada correctamente.");
      setTitle("");
      setDescription("");
      setStartDate("");
      setDueDate("");
      setEstimateHours("1");
      window.setTimeout(() => {
        setOpen(false);
        setSuccess("");
      }, 500);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible crear la tarea.");
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => {
      setOpen(next);
      if (next && defaultProjectId) setProjectId(defaultProjectId);
    }}>
      <Dialog.Trigger asChild>
        <Button className={compact ? "px-3" : undefined} aria-label={compact ? "Crear tarea" : undefined}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {!compact && <span>Nueva tarea</span>}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-ink-950/40 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[90] max-h-[92vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-white/70 bg-white p-6 shadow-float focus:outline-none sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-xl font-black tracking-[-0.03em] text-ink-950">Nueva tarea</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm leading-6 text-ink-600">Se guardará en tu modo activo y aparecerá en todas las vistas del proyecto.</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-ink-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200" aria-label="Cerrar">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          {projects.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <h2 className="font-black text-ink-950">Primero crea un proyecto</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-600">Las tareas siempre pertenecen a un proyecto. Tu workspace está vacío, tal como pediste.</p>
              <Dialog.Close asChild>
                <Link to="/projects" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-black text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200">Ir a Proyectos</Link>
              </Dialog.Close>
            </div>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
              <label className="block">
                <span className="mb-1.5 block text-sm font-black text-ink-900">Título</span>
                <input value={title} onChange={(event) => setTitle(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-ink-950 outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100" placeholder="Ej. Validar flujo de aprobación" autoFocus />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-black text-ink-900">Descripción <span className="font-semibold text-ink-500">(opcional)</span></span>
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-ink-950 outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100" placeholder="Contexto, criterio de terminado o notas…" />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-black text-ink-900">Proyecto</span>
                <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-ink-950 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100">
                  <option value="">Selecciona un proyecto</option>
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.code} · {project.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-black text-ink-900">Responsable</span>
                <select value={assigneeId || snapshot?.currentUser.id || ""} onChange={(event) => setAssigneeId(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-ink-950 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100">
                  {(snapshot?.workload ?? []).map(({ person }) => <option key={person.id} value={person.id}>{person.name} · {person.role}</option>)}
                </select>
              </label>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-black text-ink-900">Estado</span>
                  <select value={status} onChange={(event) => setStatus(event.target.value as TaskStatus)} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100">
                    {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-black text-ink-900">Prioridad</span>
                  <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100">
                    {priorityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-black text-ink-900">Estimación (h)</span>
                  <input type="number" min="0" step="0.25" value={estimateHours} onChange={(event) => setEstimateHours(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-black text-ink-900">Inicio</span>
                  <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-black text-ink-900">Fecha límite</span>
                  <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" />
                </label>
              </div>

              {error && <p className="rounded-xl bg-danger-50 px-3 py-2 text-sm font-bold text-danger-700" role="alert">{error}</p>}
              {success && <p className="rounded-xl bg-success-50 px-3 py-2 text-sm font-bold text-success-700" role="status" aria-live="polite">{success}</p>}

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <Dialog.Close asChild><Button type="button" variant="secondary">Cancelar</Button></Dialog.Close>
                <Button type="submit" disabled={isCreatingTask}>{isCreatingTask ? "Creando…" : "Crear tarea"}</Button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

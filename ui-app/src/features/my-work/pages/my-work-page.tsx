import { CalendarDays, CheckCircle2, Clock3 } from "lucide-react";
import { useMemo, useState } from "react";
import type { TaskSummary } from "../../../application/ports/workspace-port";
import { useWorkspace } from "../../../app/providers/app-providers";
import { Avatar } from "../../../shared/ui/avatar";
import { PageHeader } from "../../../shared/ui/page-header";
import { ErrorState, LoadingState } from "../../../shared/ui/state-panel";
import { TaskDrawer } from "../../tasks/components/task-drawer";

function isoDate(offsetDays = 0) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

const today = isoDate();
const weekLimit = isoDate(7);

const groups = [
  { id: "overdue", label: "Atrasadas", match: (task: TaskSummary) => Boolean(task.dueDate && task.dueDate < today) },
  { id: "today", label: "Hoy", match: (task: TaskSummary) => task.dueDate === today },
  { id: "week", label: "Próximos 7 días", match: (task: TaskSummary) => Boolean(task.dueDate && task.dueDate > today && task.dueDate <= weekLimit) },
  { id: "later", label: "Más adelante", match: (task: TaskSummary) => Boolean(task.dueDate && task.dueDate > weekLimit) },
  { id: "nodate", label: "Sin fecha", match: (task: TaskSummary) => !task.dueDate },
];

export function MyWorkPage() {
  const { snapshot, isLoading, isError, error, refetch } = useWorkspace();
  const [selectedTask, setSelectedTask] = useState<TaskSummary>();

  const myTasks = useMemo(
    () => snapshot?.tasks.filter((task) => task.assignees.some((person) => person.id === snapshot.currentUser.id) && !task.completed) ?? [],
    [snapshot],
  );

  if (isLoading) return <LoadingState label="Organizando tu trabajo…" />;
  if (isError || !snapshot) return <ErrorState message={error?.message ?? "No fue posible cargar tus tareas."} onRetry={refetch} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Mi trabajo"
        title="Tu foco, sin ruido"
        description="Tareas asignadas a ti, agrupadas por urgencia temporal y siempre dentro de la organización activa."
      />

      {myTasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-success-600" aria-hidden="true" />
          <h2 className="mt-3 font-black text-ink-950">No tienes tareas abiertas</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-600">Crea una tarea en un proyecto y aparecerá aquí automáticamente.</p>
        </div>
      ) : (
      <div className="grid gap-4">
        {groups.map((group) => {
          const items = myTasks.filter(group.match);
          if (!items.length) return null;
          return (
            <section key={group.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card" aria-labelledby={`group-${group.id}`}>
              <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
                <span className={`grid h-9 w-9 place-items-center rounded-xl ${group.id === "overdue" ? "bg-danger-50 text-danger-700" : "bg-brand-50 text-brand-700"}`}>
                  {group.id === "overdue" ? <Clock3 className="h-4 w-4" aria-hidden="true" /> : <CalendarDays className="h-4 w-4" aria-hidden="true" />}
                </span>
                <h2 id={`group-${group.id}`} className="font-bold text-ink-950">{group.label}</h2>
                <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-black text-ink-500">{items.length}</span>
              </div>
              <div className="divide-y divide-slate-100">
                {items.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className="flex min-h-16 w-full items-center gap-3 px-5 py-3 text-left hover:bg-brand-50/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-brand-200"
                  >
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-slate-300 text-success-700">
                      <CheckCircle2 className="h-3.5 w-3.5 opacity-0" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-ink-950">{task.title}</p>
                      <p className="mt-0.5 text-xs font-semibold text-ink-500">{task.projectCode} · {task.labels.join(" · ") || "Sin etiquetas"}</p>
                    </div>
                    <span className={`hidden text-xs font-bold sm:block ${Boolean(task.dueDate && task.dueDate < today) ? "text-danger-700" : "text-ink-500"}`}>{task.dueDate ?? "Sin fecha"}</span>
                    <div className="flex -space-x-1.5">
                      {task.assignees.map((person) => <Avatar key={person.id} person={person} size="sm" className="ring-2 ring-white" />)}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      )}

      <TaskDrawer task={selectedTask} open={Boolean(selectedTask)} onOpenChange={(open) => !open && setSelectedTask(undefined)} />
    </div>
  );
}

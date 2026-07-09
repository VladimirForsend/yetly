import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  ArrowDownUp,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDot,
  Columns3,
  Filter,
  GanttChart,
  LayoutList,
  MoreHorizontal,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import type { TaskStatus, TaskSummary } from "../../../application/ports/workspace-port";
import { useWorkspace } from "../../../app/providers/app-providers";
import { cn } from "../../../shared/lib/cn";
import { formatMinutes } from "../../../shared/lib/format";
import { Avatar } from "../../../shared/ui/avatar";
import { Button } from "../../../shared/ui/button";
import { HealthBadge } from "../../../shared/ui/health-badge";
import { ProgressBar } from "../../../shared/ui/progress-bar";
import { ErrorState, LoadingState } from "../../../shared/ui/state-panel";
import { QuickAddDialog } from "../../tasks/components/quick-add-dialog";
import { EditProjectDialog } from "../components/edit-project-dialog";
import { TaskDrawer } from "../../tasks/components/task-drawer";

const viewOptions = [
  { id: "overview", label: "Resumen", Icon: CircleDot },
  { id: "list", label: "Lista", Icon: LayoutList },
  { id: "board", label: "Tablero", Icon: Columns3 },
  { id: "calendar", label: "Calendario", Icon: CalendarDays },
  { id: "timeline", label: "Timeline", Icon: GanttChart },
  { id: "workload", label: "Carga", Icon: Users },
];

const statusMeta: Record<TaskStatus, { label: string; dot: string }> = {
  backlog: { label: "Backlog", dot: "bg-slate-400" },
  todo: { label: "Por hacer", dot: "bg-blue-500" },
  in_progress: { label: "En curso", dot: "bg-brand-600" },
  review: { label: "Revisión", dot: "bg-warning-600" },
  done: { label: "Completada", dot: "bg-success-600" },
};

const priorityMeta = {
  low: { label: "Baja", className: "text-ink-500" },
  normal: { label: "Normal", className: "text-blue-600" },
  high: { label: "Alta", className: "text-warning-700" },
  urgent: { label: "Urgente", className: "text-danger-700" },
};

function TaskActions({
  task,
  onMove,
}: {
  task: TaskSummary;
  onMove: (taskId: string, status: TaskStatus) => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="grid h-9 w-9 place-items-center rounded-lg text-ink-500 hover:bg-slate-100 hover:text-ink-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200"
          aria-label={`Acciones de ${task.title}`}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="z-50 min-w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-float" sideOffset={6} align="end">
          <DropdownMenu.Label className="px-2 py-1.5 text-[11px] font-black uppercase tracking-wider text-ink-500">Mover a</DropdownMenu.Label>
          {(Object.keys(statusMeta) as TaskStatus[]).map((status) => (
            <DropdownMenu.Item
              key={status}
              onSelect={() => onMove(task.id, status)}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-semibold text-ink-800 outline-none data-[highlighted]:bg-brand-50"
            >
              <span className={cn("h-2.5 w-2.5 rounded-full", statusMeta[status].dot)} aria-hidden="true" />
              {statusMeta[status].label}
              {task.status === status && <Check className="ml-auto h-4 w-4 text-brand-600" aria-hidden="true" />}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function ListView({
  tasks,
  onOpenTask,
  onMove,
}: {
  tasks: TaskSummary[];
  onOpenTask: (task: TaskSummary) => void;
  onMove: (taskId: string, status: TaskStatus) => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card" aria-labelledby="list-view-heading">
      <h2 id="list-view-heading" className="sr-only">Vista lista</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-black uppercase tracking-[0.08em] text-ink-500">
              <th className="w-12 px-4 py-3"><span className="sr-only">Completar</span></th>
              <th className="px-3 py-3">Tarea</th>
              <th className="px-3 py-3">Estado</th>
              <th className="px-3 py-3">Responsables</th>
              <th className="px-3 py-3">Prioridad</th>
              <th className="px-3 py-3">Fecha</th>
              <th className="px-3 py-3">Tiempo</th>
              <th className="w-12 px-3 py-3"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tasks.map((task) => (
              <tr key={task.id} className="group hover:bg-brand-50/30">
                <td className="px-4 py-3">
                  <span className={cn("grid h-5 w-5 place-items-center rounded-full border", task.completed ? "border-success-600 bg-success-600 text-white" : "border-slate-300 bg-white")}>
                    {task.completed && <Check className="h-3 w-3" aria-hidden="true" />}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <button onClick={() => onOpenTask(task)} className="max-w-md text-left text-sm font-bold text-ink-950 hover:text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200">
                    {task.title}
                  </button>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {task.labels.slice(0, 2).map((label) => <span key={label} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-ink-500">{label}</span>)}
                    {task.blockedReason && <span className="rounded bg-danger-50 px-1.5 py-0.5 text-[10px] font-bold text-danger-700">Bloqueada</span>}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink-700">
                    <span className={cn("h-2.5 w-2.5 rounded-full", statusMeta[task.status].dot)} aria-hidden="true" />
                    {statusMeta[task.status].label}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex -space-x-1.5">
                    {task.assignees.map((person) => <Avatar key={person.id} person={person} size="sm" className="ring-2 ring-white" />)}
                  </div>
                </td>
                <td className={cn("px-3 py-3 text-sm font-bold", priorityMeta[task.priority].className)}>{priorityMeta[task.priority].label}</td>
                <td className="whitespace-nowrap px-3 py-3 text-sm font-semibold text-ink-600">{task.dueDate ?? "Sin fecha"}</td>
                <td className="whitespace-nowrap px-3 py-3 text-sm font-semibold text-ink-600">{formatMinutes(task.actualMinutes)} / {formatMinutes(task.estimateMinutes)}</td>
                <td className="px-3 py-3"><TaskActions task={task} onMove={onMove} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BoardView({
  tasks,
  projectId,
  onOpenTask,
  onMove,
}: {
  tasks: TaskSummary[];
  projectId: string;
  onOpenTask: (task: TaskSummary) => void;
  onMove: (taskId: string, status: TaskStatus) => void;
}) {
  const columns = (Object.keys(statusMeta) as TaskStatus[]).map((status) => ({
    status,
    tasks: tasks.filter((task) => task.status === status),
  }));

  return (
    <section aria-labelledby="board-view-heading">
      <h2 id="board-view-heading" className="sr-only">Tablero por estado</h2>
      <div className="flex snap-x gap-4 overflow-x-auto pb-3">
        {columns.map((column) => (
          <div key={column.status} className="w-[min(84vw,310px)] shrink-0 snap-start rounded-2xl border border-slate-200 bg-slate-100/70 p-3">
            <div className="flex items-center gap-2 px-1 py-1">
              <span className={cn("h-2.5 w-2.5 rounded-full", statusMeta[column.status].dot)} aria-hidden="true" />
              <h3 className="text-sm font-black text-ink-950">{statusMeta[column.status].label}</h3>
              <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[11px] font-black text-ink-500">{column.tasks.length}</span>
            </div>
            <div className="mt-3 space-y-2">
              {column.tasks.map((task) => (
                <article key={task.id} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <button onClick={() => onOpenTask(task)} className="text-left text-sm font-bold leading-5 text-ink-950 hover:text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200">
                      {task.title}
                    </button>
                    <TaskActions task={task} onMove={onMove} />
                  </div>
                  {task.blockedReason && <p className="mt-2 rounded-lg bg-danger-50 px-2 py-1 text-[11px] font-semibold leading-4 text-danger-700">Bloqueada</p>}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {task.labels.slice(0, 2).map((label) => <span key={label} className="rounded-md bg-brand-50 px-2 py-1 text-[10px] font-bold text-brand-700">{label}</span>)}
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="flex -space-x-1.5">
                      {task.assignees.map((person) => <Avatar key={person.id} person={person} size="sm" className="ring-2 ring-white" />)}
                    </div>
                    <span className={cn("text-[11px] font-black", priorityMeta[task.priority].className)}>{task.dueDate ?? "Sin fecha"}</span>
                  </div>
                </article>
              ))}
              <div className="pt-1">
                <QuickAddDialog compact defaultProjectId={projectId} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CalendarView({ tasks, onOpenTask }: { tasks: TaskSummary[]; onOpenTask: (task: TaskSummary) => void }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const first = new Date(year, month, 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - mondayOffset);
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
  const tasksByDate = new Map<string, TaskSummary[]>();
  tasks.filter((task) => task.dueDate).forEach((task) => {
    const key = task.dueDate!;
    tasksByDate.set(key, [...(tasksByDate.get(key) ?? []), task]);
  });
  const monthLabel = first.toLocaleDateString("es-CL", { month: "long", year: "numeric" });

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card" aria-labelledby="calendar-view-heading">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-5">
        <div>
          <h2 id="calendar-view-heading" className="font-bold capitalize text-ink-950">{monthLabel}</h2>
          <p className="text-xs text-ink-500">Fechas límite reales de tus tareas</p>
        </div>
        <span className="rounded-xl bg-brand-50 px-3 py-2 text-xs font-black text-brand-700">Hoy {today.getDate()}</span>
      </div>
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => <div key={day} className="px-2 py-2 text-center text-[10px] font-black uppercase tracking-wider text-ink-500">{day}</div>)}
      </div>
      <div className="grid min-w-[700px] grid-cols-7">
        {days.map((date) => {
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
          const inMonth = date.getMonth() === month;
          const isToday = key === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
          const dayTasks = tasksByDate.get(key) ?? [];
          return (
            <div key={key} className="min-h-28 border-b border-r border-slate-100 p-2">
              <span className={cn("grid h-7 w-7 place-items-center rounded-full text-xs font-bold", isToday ? "bg-brand-600 text-white" : inMonth ? "text-ink-700" : "text-slate-300")}>
                {date.getDate()}
              </span>
              <div className="mt-1 space-y-1">
                {dayTasks.slice(0, 3).map((task) => (
                  <button key={task.id} onClick={() => onOpenTask(task)} className="block w-full truncate rounded-md bg-brand-50 px-1.5 py-1 text-left text-[10px] font-bold text-brand-700 hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300">
                    {task.title}
                  </button>
                ))}
                {dayTasks.length > 3 && <span className="block px-1 text-[10px] font-bold text-ink-500">+{dayTasks.length - 3} más</span>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TimelineView({ tasks }: { tasks: TaskSummary[] }) {
  const dated = tasks.filter((task) => task.startDate || task.dueDate).slice(0, 20);
  if (!dated.length) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center" aria-labelledby="timeline-view-heading">
        <GanttChart className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
        <h2 id="timeline-view-heading" className="mt-3 font-black text-ink-950">Aún no hay tareas con fechas</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-600">Agrega inicio o fecha límite a una tarea para verla en el timeline.</p>
      </section>
    );
  }

  const parse = (value: string) => new Date(`${value}T00:00:00`);
  const dayMs = 86_400_000;
  const starts = dated.map((task) => parse(task.startDate ?? task.dueDate!));
  const ends = dated.map((task) => parse(task.dueDate ?? task.startDate!));
  const minTime = Math.min(...starts.map((date) => date.getTime()));
  const maxTime = Math.max(...ends.map((date) => date.getTime()));
  const rangeStart = new Date(minTime);
  const naturalDays = Math.max(7, Math.ceil((maxTime - minTime) / dayMs) + 1);
  const dayCount = Math.min(31, naturalDays);
  const rangeEnd = new Date(rangeStart.getTime() + (dayCount - 1) * dayMs);
  const days = Array.from({ length: dayCount }, (_, index) => new Date(rangeStart.getTime() + index * dayMs));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIndex = Math.round((today.getTime() - rangeStart.getTime()) / dayMs);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card" aria-labelledby="timeline-view-heading">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 id="timeline-view-heading" className="font-bold text-ink-950">Timeline del proyecto</h2>
        <p className="mt-0.5 text-xs text-ink-500">{rangeStart.toLocaleDateString("es-CL")} – {rangeEnd.toLocaleDateString("es-CL")} · fechas reales</p>
      </div>
      <div className="overflow-x-auto">
        <div style={{ minWidth: `${280 + dayCount * 48}px` }}>
          <div className="grid border-b border-slate-200 bg-slate-50" style={{ gridTemplateColumns: `280px repeat(${dayCount}, minmax(48px, 1fr))` }}>
            <div className="px-4 py-2 text-[10px] font-black uppercase tracking-wider text-ink-500">Tarea</div>
            {days.map((day) => <div key={day.toISOString()} className="border-l border-slate-200 px-1 py-2 text-center text-[10px] font-bold text-ink-500">{day.getDate()}</div>)}
          </div>
          {dated.map((task) => {
            const taskStart = parse(task.startDate ?? task.dueDate!);
            const taskEnd = parse(task.dueDate ?? task.startDate!);
            const startIndex = Math.min(dayCount - 1, Math.max(0, Math.round((taskStart.getTime() - rangeStart.getTime()) / dayMs)));
            const endIndex = Math.min(dayCount - 1, Math.max(startIndex, Math.round((taskEnd.getTime() - rangeStart.getTime()) / dayMs)));
            const span = endIndex - startIndex + 1;
            return (
              <div key={task.id} className="grid border-b border-slate-100" style={{ gridTemplateColumns: `280px repeat(${dayCount}, minmax(48px, 1fr))` }}>
                <div className="truncate px-4 py-3 text-sm font-semibold text-ink-800">{task.title}</div>
                <div className="relative col-span-full col-start-2 grid" style={{ gridTemplateColumns: `repeat(${dayCount}, minmax(48px, 1fr))` }}>
                  {days.map((day) => <span key={day.toISOString()} className="border-r border-slate-100" />)}
                  <div className="absolute bottom-2 top-2 rounded-md bg-gradient-to-r from-brand-600 to-blue-500 px-2 text-[10px] font-bold leading-7 text-white shadow-sm" style={{ left: `calc(${(startIndex / dayCount) * 100}% + 3px)`, width: `calc(${(span / dayCount) * 100}% - 6px)` }}>
                    <span className="block truncate">{task.projectCode}</span>
                  </div>
                  {todayIndex >= 0 && todayIndex < dayCount && <div className="absolute bottom-0 top-0 w-px bg-danger-600/70" style={{ left: `${(todayIndex / dayCount) * 100}%` }} aria-label="Hoy" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ProjectWorkloadView({ tasks }: { tasks: TaskSummary[] }) {
  const byPerson = new Map<string, { person: TaskSummary["assignees"][number]; minutes: number; count: number }>();
  tasks.forEach((task) => task.assignees.forEach((person) => {
    const current = byPerson.get(person.id) ?? { person, minutes: 0, count: 0 };
    current.minutes += task.estimateMinutes / Math.max(task.assignees.length, 1);
    current.count += 1;
    byPerson.set(person.id, current);
  }));
  const rows = [...byPerson.values()];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6" aria-labelledby="project-workload-heading">
      <h2 id="project-workload-heading" className="font-bold text-ink-950">Carga estimada del proyecto</h2>
      <p className="mt-1 text-sm text-ink-500">Estimación activa agrupada por responsable para este proyecto.</p>
      <div className="mt-6 space-y-5">
        {rows.map((row) => {
          const utilization = Math.min(100, (row.minutes / 1200) * 100);
          return (
            <div key={row.person.id}>
              <div className="mb-2 flex items-center gap-3">
                <Avatar person={row.person} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink-950">{row.person.name}</p>
                  <p className="text-xs text-ink-500">{row.count} tareas · {formatMinutes(Math.round(row.minutes))}</p>
                </div>
              </div>
              <div className="h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-600" style={{ width: `${utilization}%` }} /></div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function OverviewView({ tasks, progress, health, healthReason }: { tasks: TaskSummary[]; progress: number; health: Parameters<typeof HealthBadge>[0]["health"]; healthReason: string }) {
  const done = tasks.filter((task) => task.completed).length;
  const blocked = tasks.filter((task) => task.blockedReason).length;
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6 lg:col-span-2">
        <h2 className="font-bold text-ink-950">Avance del proyecto</h2>
        <div className="mt-5 flex items-end gap-3">
          <span className="text-5xl font-black tracking-[-0.05em] text-ink-950">{progress}%</span>
          <span className="pb-1 text-sm font-semibold text-ink-500">{done} de {tasks.length} tareas completadas</span>
        </div>
        <ProgressBar value={progress} className="mt-5 h-3" label="Avance del proyecto" />
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
        <h2 className="font-bold text-ink-950">Salud</h2>
        <div className="mt-4"><HealthBadge health={health} /></div>
        <p className="mt-3 text-sm leading-6 text-ink-600">{healthReason}</p>
        {blocked > 0 && <p className="mt-3 rounded-xl bg-danger-50 px-3 py-2 text-xs font-bold text-danger-700">{blocked} tarea bloqueada</p>}
      </section>
    </div>
  );
}

export function ProjectPage() {
  const { projectId, view = "list" } = useParams();
  const { snapshot, isLoading, isError, error, refetch, moveTask, isMovingTask } = useWorkspace();
  const [selectedTask, setSelectedTask] = useState<TaskSummary>();
  const [search, setSearch] = useState("");
  const [announcement, setAnnouncement] = useState("");

  const project = snapshot?.projects.find((item) => item.id === projectId);
  const tasks = useMemo(
    () => (snapshot?.tasks ?? []).filter((task) => task.projectId === projectId && task.title.toLowerCase().includes(search.toLowerCase())),
    [snapshot?.tasks, projectId, search],
  );

  if (isLoading) return <LoadingState label="Cargando proyecto…" />;
  if (isError || !snapshot) return <ErrorState message={error?.message ?? "No fue posible cargar el proyecto."} onRetry={refetch} />;
  if (!project) return <Navigate to="/projects" replace />;

  async function handleMove(taskId: string, status: TaskStatus) {
    const task = tasks.find((item) => item.id === taskId);
    try {
      await moveTask(taskId, status);
      setAnnouncement(`${task?.title ?? "La tarea"} se movió a ${statusMeta[status].label}.`);
    } catch (reason) {
      setAnnouncement(reason instanceof Error ? reason.message : "No fue posible mover la tarea.");
    }
  }

  const currentView = viewOptions.some((option) => option.id === view) ? view : "list";

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-black text-ink-600">{project.code}</span>
              <HealthBadge health={project.health} />
            </div>
            <h1 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink-950 sm:text-3xl">{project.name}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-600">{project.healthReason}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-40">
              <div className="mb-1.5 flex items-center justify-between gap-3 text-xs font-bold text-ink-500"><span>Progreso</span><span>{project.progress}%</span></div>
              <ProgressBar value={project.progress} />
            </div>
            <Avatar person={project.owner} size="lg" />
            <EditProjectDialog project={project} />
            <QuickAddDialog defaultProjectId={project.id} />
          </div>
        </div>
      </header>

      <nav className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-card" aria-label="Vistas del proyecto">
        <ul className="flex min-w-max gap-1">
          {viewOptions.map(({ id, label, Icon }) => (
            <li key={id}>
              <Link
                to={`/projects/${project.id}/${id}`}
                className={cn(
                  "flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-bold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200",
                  currentView === id ? "bg-brand-50 text-brand-700" : "text-ink-600 hover:bg-slate-50 hover:text-ink-950",
                )}
                aria-current={currentView === id ? "page" : undefined}
              >
                <Icon className="h-4 w-4" aria-hidden="true" /> {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {["list", "board"].includes(currentView) && (
        <section className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-card sm:flex-row" aria-label="Herramientas de vista">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Buscar tareas</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar dentro del proyecto…"
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"
            />
          </label>
          <span className="inline-flex min-h-10 items-center rounded-xl bg-slate-50 px-3 text-xs font-bold text-ink-500">{tasks.length} tarea{tasks.length === 1 ? "" : "s"}</span>
        </section>
      )}

      <div className="sr-only" role="status" aria-live="polite">{announcement}</div>

      {currentView === "overview" && <OverviewView tasks={tasks} progress={project.progress} health={project.health} healthReason={project.healthReason} />}
      {currentView === "list" && <ListView tasks={tasks} onOpenTask={setSelectedTask} onMove={handleMove} />}
      {currentView === "board" && <BoardView tasks={tasks} projectId={project.id} onOpenTask={setSelectedTask} onMove={handleMove} />}
      {currentView === "calendar" && <CalendarView tasks={tasks} onOpenTask={setSelectedTask} />}
      {currentView === "timeline" && <TimelineView tasks={tasks} />}
      {currentView === "workload" && <ProjectWorkloadView tasks={tasks} />}

      {isMovingTask && <div className="fixed bottom-5 right-5 z-40 rounded-xl bg-ink-950 px-4 py-3 text-sm font-bold text-white shadow-float" role="status">Actualizando tarea…</div>}

      <TaskDrawer task={selectedTask} open={Boolean(selectedTask)} onOpenChange={(open) => !open && setSelectedTask(undefined)} />
    </div>
  );
}

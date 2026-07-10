import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Clock3,
  FolderKanban,
  TrendingUp,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useWorkspace } from "../../../app/providers/app-providers";
import { formatMinutes } from "../../../shared/lib/format";
import { Avatar } from "../../../shared/ui/avatar";
import { HealthBadge } from "../../../shared/ui/health-badge";
import { PageHeader } from "../../../shared/ui/page-header";
import { ProgressBar } from "../../../shared/ui/progress-bar";
import { ErrorState, LoadingState } from "../../../shared/ui/state-panel";
import { QuickAddDialog } from "../../tasks/components/quick-add-dialog";
import { CreateProjectDialog } from "../../projects/components/create-project-dialog";

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "brand",
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof FolderKanban;
  tone?: "brand" | "danger" | "warning" | "success";
}) {
  const tones = {
    brand: "bg-brand-50 text-brand-700",
    danger: "bg-danger-50 text-danger-700",
    warning: "bg-warning-50 text-warning-700",
    success: "bg-success-50 text-success-700",
  };

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink-600">{label}</p>
          <p className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink-950">{value}</p>
        </div>
        <span className={`grid h-10 w-10 place-items-center rounded-xl ${tones[tone]}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-xs font-medium leading-5 text-ink-500">{hint}</p>
    </article>
  );
}

export function DashboardPage() {
  const { snapshot, isLoading, isError, error, refetch } = useWorkspace();

  if (isLoading) return <LoadingState label="Preparando el panorama de la organización…" />;
  if (isError || !snapshot) return <ErrorState message={error?.message ?? "No hay datos disponibles."} onRetry={refetch} />;

  const today = new Date().toISOString().slice(0, 10);
  const activeProjects = snapshot.projects.filter((project) => project.status === "active");
  const riskProjects = snapshot.projects.filter((project) => project.health === "red");
  const overdueTasks = snapshot.tasks.filter((task) => Boolean(task.dueDate && task.dueDate < today && !task.completed));
  const blockedTasks = snapshot.tasks.filter((task) => Boolean(task.blockedReason));
  const overloaded = snapshot.workload.filter((person) => person.assignedMinutes > person.capacityMinutes);
  const attentionTasks = snapshot.tasks
    .filter((task) => task.priority === "urgent" || task.blockedReason || Boolean(task.dueDate && task.dueDate < today))
    .slice(0, 4);
  const maxDay = Math.max(...snapshot.weeklyTime.map((point) => point.minutes), 1);

  return (
    <div className="space-y-7 pb-20 lg:pb-0">
      <PageHeader
        eyebrow="Panorama ejecutivo"
        title={`Buenos días, ${snapshot.currentUser.name.split(" ")[0]}`}
        description="Una lectura rápida de avance, riesgo, carga y tiempo para decidir dónde intervenir."
        actions={<QuickAddDialog />}
      />

      {snapshot.projects.length === 0 && (
        <section className="rounded-3xl border border-brand-200 bg-gradient-to-br from-brand-50 to-blue-50 p-6 sm:p-8" aria-labelledby="empty-dashboard-heading">
          <p className="text-xs font-black uppercase tracking-[.14em] text-brand-700">Workspace listo</p>
          <h2 id="empty-dashboard-heading" className="mt-2 text-2xl font-black tracking-[-0.04em] text-ink-950">Crea tu primer proyecto</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-600">No cargamos datos simulados. Cuando agregues proyectos, tareas y tiempo, este dashboard empezará a calcular progreso, salud, vencimientos y carga.</p>
          <div className="mt-5"><CreateProjectDialog /></div>
        </section>
      )}

      <section aria-labelledby="summary-heading">
        <h2 id="summary-heading" className="sr-only">Resumen operativo</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Proyectos activos"
            value={String(activeProjects.length)}
            hint={`${snapshot.projects.length} proyectos visibles en el portfolio`}
            icon={FolderKanban}
          />
          <MetricCard
            label="Proyectos en riesgo"
            value={String(riskProjects.length)}
            hint={riskProjects[0]?.healthReason ?? "Sin alertas críticas"}
            icon={AlertTriangle}
            tone={riskProjects.length ? "danger" : "success"}
          />
          <MetricCard
            label="Trabajo vencido"
            value={String(overdueTasks.length)}
            hint={`${blockedTasks.length} tarea${blockedTasks.length === 1 ? "" : "s"} bloqueada${blockedTasks.length === 1 ? "" : "s"}`}
            icon={CalendarClock}
            tone={overdueTasks.length ? "warning" : "success"}
          />
          <MetricCard
            label="Personas sobrecargadas"
            value={String(overloaded.length)}
            hint={`${snapshot.workload.length} personas con capacidad registrada`}
            icon={Users}
            tone={overloaded.length ? "warning" : "success"}
          />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.75fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-card" aria-labelledby="projects-health-heading">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
            <div>
              <h2 id="projects-health-heading" className="font-bold text-ink-950">Salud de proyectos</h2>
              <p className="mt-0.5 text-xs text-ink-500">Cada estado incluye una razón explicable.</p>
            </div>
            <Link className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm font-bold text-brand-700 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200" to="/projects">
              Portfolio <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {snapshot.projects.slice(0, 4).map((project) => (
              <article key={project.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: project.accent }} aria-hidden="true" />
                    <Link to={`/projects/${project.id}/list`} className="truncate font-bold text-ink-950 hover:text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200">
                      {project.name}
                    </Link>
                    <span className="shrink-0 text-xs font-semibold text-ink-500">{project.code}</span>
                  </div>
                  <p className="mt-1.5 line-clamp-1 text-xs leading-5 text-ink-500">{project.healthReason}</p>
                  <div className="mt-3 flex items-center gap-3">
                    <ProgressBar value={project.progress} className="max-w-56 flex-1" label={`Progreso de ${project.name}`} />
                    <span className="text-xs font-black tabular-nums text-ink-700">{project.progress}%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <HealthBadge health={project.health} />
                  <Avatar person={project.owner} size="sm" />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6" aria-labelledby="attention-heading">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-warning-50 text-warning-700">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h2 id="attention-heading" className="font-bold text-ink-950">Necesita atención</h2>
              <p className="text-xs text-ink-500">Priorizado por urgencia y bloqueo</p>
            </div>
          </div>

          <ul className="mt-4 space-y-2">
            {attentionTasks.map((task) => (
              <li key={task.id}>
                <Link
                  to={`/projects/${task.projectId}/list`}
                  className="group block rounded-xl border border-slate-100 p-3 hover:border-brand-200 hover:bg-brand-50/50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200"
                >
                  <div className="flex items-start gap-3">
                    <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${task.blockedReason ? "bg-danger-600" : "bg-warning-600"}`} aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm font-bold leading-5 text-ink-950 group-hover:text-brand-700">{task.title}</p>
                      <p className="mt-1 text-xs font-medium text-ink-500">{task.projectCode} · {task.dueDate ?? "Sin fecha"}</p>
                      {task.blockedReason && <p className="mt-1 line-clamp-1 text-xs text-danger-700">Bloqueada: {task.blockedReason}</p>}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6" aria-labelledby="workload-heading">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 id="workload-heading" className="font-bold text-ink-950">Carga del equipo</h2>
              <p className="mt-0.5 text-xs text-ink-500">Estimado asignado vs capacidad semanal</p>
            </div>
            <Link to="/workload" className="rounded-lg p-2 text-brand-700 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200" aria-label="Ver carga de trabajo completa">
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <ul className="mt-5 space-y-4">
            {snapshot.workload.slice(0, 4).map((item) => {
              const utilization = Math.round((item.assignedMinutes / item.capacityMinutes) * 100);
              return (
                <li key={item.person.id}>
                  <div className="mb-2 flex items-center gap-2">
                    <Avatar person={item.person} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-900">{item.person.name}</span>
                    <span className={`text-xs font-black tabular-nums ${utilization > 100 ? "text-danger-700" : "text-ink-600"}`}>{utilization}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={`Carga de ${item.person.name}`} aria-valuemin={0} aria-valuemax={Math.max(120, utilization)} aria-valuenow={utilization}>
                    <div className={`h-full rounded-full ${utilization > 100 ? "bg-danger-600" : utilization > 90 ? "bg-warning-600" : "bg-brand-600"}`} style={{ width: `${Math.min(utilization, 100)}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6" aria-labelledby="time-heading">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-600">
              <Clock3 className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h2 id="time-heading" className="font-bold text-ink-950">Tiempo esta semana</h2>
              <p className="text-xs text-ink-500">{formatMinutes(snapshot.weeklyTime.reduce((total, point) => total + point.minutes, 0))} registradas</p>
            </div>
          </div>
          <div className="mt-6 flex h-40 items-end justify-between gap-3" aria-label="Horas registradas por día">
            {snapshot.weeklyTime.map((point) => (
              <div key={point.day} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <span className="text-[10px] font-bold text-ink-500">{formatMinutes(point.minutes)}</span>
                <div className="w-full max-w-9 rounded-t-lg bg-gradient-to-t from-brand-600 to-blue-500" style={{ height: `${Math.max(16, (point.minutes / maxDay) * 110)}px` }} />
                <span className="text-xs font-bold text-ink-600">{point.day}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6 lg:col-span-2 xl:col-span-1" aria-labelledby="activity-heading">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-success-50 text-success-700">
              <TrendingUp className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h2 id="activity-heading" className="font-bold text-ink-950">Actividad reciente</h2>
              <p className="text-xs text-ink-500">Cambios relevantes del equipo</p>
            </div>
          </div>
          <ol className="mt-5 space-y-4">
            {snapshot.activities.map((activity) => (
              <li key={activity.id} className="flex gap-3">
                <Avatar person={activity.actor} size="sm" />
                <div className="min-w-0 text-sm leading-5">
                  <p className="text-ink-600">
                    <span className="font-bold text-ink-950">{activity.actor.name.split(" ")[0]}</span>{" "}
                    {activity.action} <span className="font-semibold text-ink-900">{activity.objectLabel}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-ink-500">{activity.timestampLabel}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}

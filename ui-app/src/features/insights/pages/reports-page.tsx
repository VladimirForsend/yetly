import { BarChart3, Clock3, TrendingUp } from "lucide-react";
import { useWorkspace } from "../../../app/providers/app-providers";
import { formatMinutes } from "../../../shared/lib/format";
import { PageHeader } from "../../../shared/ui/page-header";
import { ErrorState, LoadingState } from "../../../shared/ui/state-panel";

export function ReportsPage() {
  const { snapshot, isLoading, isError, error, refetch } = useWorkspace();

  if (isLoading) return <LoadingState label="Preparando reportes…" />;
  if (isError || !snapshot) return <ErrorState message={error?.message ?? "No fue posible cargar los reportes."} onRetry={refetch} />;

  const maxActual = Math.max(...snapshot.projects.map((project) => project.actualMinutes), 1);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Insights"
        title="Reportes"
        description="Tiempo por proyecto, esfuerzo por persona y desviación estimado vs real con datos del contexto activo."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <Clock3 className="h-5 w-5 text-brand-600" aria-hidden="true" />
          <p className="mt-4 text-3xl font-black text-ink-950">{formatMinutes(snapshot.projects.reduce((total, project) => total + project.actualMinutes, 0))}</p>
          <p className="mt-1 text-sm font-semibold text-ink-500">Tiempo total registrado</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <TrendingUp className="h-5 w-5 text-success-700" aria-hidden="true" />
          <p className="mt-4 text-3xl font-black text-ink-950">{Math.round(snapshot.projects.reduce((total, project) => total + project.progress, 0) / snapshot.projects.length)}%</p>
          <p className="mt-1 text-sm font-semibold text-ink-500">Progreso medio del portfolio</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <BarChart3 className="h-5 w-5 text-blue-600" aria-hidden="true" />
          <p className="mt-4 text-3xl font-black text-ink-950">{snapshot.projects.length}</p>
          <p className="mt-1 text-sm font-semibold text-ink-500">Proyectos analizados</p>
        </article>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6" aria-labelledby="time-project-heading">
        <h2 id="time-project-heading" className="font-bold text-ink-950">Tiempo por proyecto</h2>
        <p className="mt-1 text-xs text-ink-500">Comparación visual del tiempo real registrado.</p>
        <div className="mt-6 space-y-5">
          {snapshot.projects.map((project) => {
            const variance = project.estimateMinutes ? ((project.actualMinutes - project.estimateMinutes) / project.estimateMinutes) * 100 : 0;
            return (
              <div key={project.id} className="grid gap-2 md:grid-cols-[220px_minmax(0,1fr)_130px] md:items-center">
                <div>
                  <p className="truncate text-sm font-bold text-ink-950">{project.name}</p>
                  <p className="text-xs text-ink-500">{project.code}</p>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-blue-500" style={{ width: `${Math.max(4, (project.actualMinutes / maxActual) * 100)}%` }} />
                </div>
                <div className="text-left md:text-right">
                  <p className="text-sm font-black text-ink-950">{formatMinutes(project.actualMinutes)}</p>
                  <p className={`text-xs font-bold ${variance > 0 ? "text-danger-700" : "text-success-700"}`}>{variance > 0 ? "+" : ""}{Math.round(variance)}% vs estimado</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

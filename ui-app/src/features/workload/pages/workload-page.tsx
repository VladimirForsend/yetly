import { AlertTriangle, CalendarRange, Users } from "lucide-react";
import { useWorkspace } from "../../../app/providers/app-providers";
import { formatMinutes } from "../../../shared/lib/format";
import { Avatar } from "../../../shared/ui/avatar";
import { PageHeader } from "../../../shared/ui/page-header";
import { ErrorState, LoadingState } from "../../../shared/ui/state-panel";

export function WorkloadPage() {
  const { snapshot, isLoading, isError, error, refetch } = useWorkspace();

  if (isLoading) return <LoadingState label="Calculando capacidad…" />;
  if (isError || !snapshot) return <ErrorState message={error?.message ?? "No fue posible calcular la carga."} onRetry={refetch} />;

  const overloaded = snapshot.workload.filter((item) => item.assignedMinutes > item.capacityMinutes);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Capacidad"
        title="Carga de trabajo"
        description="Compara trabajo estimado con capacidad semanal. La carga se recalcula desde tus tareas abiertas."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <Users className="h-5 w-5 text-brand-600" aria-hidden="true" />
          <p className="mt-3 text-3xl font-black text-ink-950">{snapshot.workload.length}</p>
          <p className="mt-1 text-sm font-semibold text-ink-500">Personas con capacidad</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <AlertTriangle className="h-5 w-5 text-warning-700" aria-hidden="true" />
          <p className="mt-3 text-3xl font-black text-ink-950">{overloaded.length}</p>
          <p className="mt-1 text-sm font-semibold text-ink-500">Personas sobrecargadas</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <CalendarRange className="h-5 w-5 text-blue-600" aria-hidden="true" />
          <p className="mt-3 text-3xl font-black text-ink-950">7–11 jul</p>
          <p className="mt-1 text-sm font-semibold text-ink-500">Periodo visible</p>
        </article>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card" aria-labelledby="workload-table-heading">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 id="workload-table-heading" className="font-bold text-ink-950">Capacidad semanal por persona</h2>
          <p className="mt-0.5 text-xs text-ink-500">Barra al 100% = capacidad disponible consumida.</p>
        </div>
        <div className="divide-y divide-slate-100">
          {snapshot.workload.map((item) => {
            const utilization = Math.round((item.assignedMinutes / item.capacityMinutes) * 100);
            return (
              <article key={item.person.id} className="grid gap-4 px-5 py-5 md:grid-cols-[minmax(220px,.8fr)_minmax(300px,1.4fr)_auto] md:items-center">
                <div className="flex items-center gap-3">
                  <Avatar person={item.person} size="lg" />
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-ink-950">{item.person.name}</h3>
                    <p className="mt-0.5 text-xs text-ink-500">{item.teamName} · {item.taskCount} tareas</p>
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold">
                    <span className="text-ink-500">{formatMinutes(item.assignedMinutes)} asignadas</span>
                    <span className={utilization > 100 ? "text-danger-700" : "text-ink-700"}>{utilization}%</span>
                  </div>
                  <div className="relative h-3 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={`Carga de ${item.person.name}`} aria-valuemin={0} aria-valuemax={Math.max(120, utilization)} aria-valuenow={utilization}>
                    <div className={`h-full rounded-full ${utilization > 100 ? "bg-danger-600" : utilization > 90 ? "bg-warning-600" : "bg-brand-600"}`} style={{ width: `${Math.min(100, utilization)}%` }} />
                  </div>
                </div>
                <div className="min-w-32 rounded-xl bg-slate-50 px-3 py-2 text-right">
                  <p className="text-[11px] font-bold text-ink-500">Capacidad</p>
                  <p className="mt-0.5 text-sm font-black text-ink-950">{formatMinutes(item.capacityMinutes)}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

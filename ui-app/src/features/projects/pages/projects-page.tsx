import { ArrowUpRight, Filter, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useWorkspace } from "../../../app/providers/app-providers";
import { formatMinutes } from "../../../shared/lib/format";
import { Avatar } from "../../../shared/ui/avatar";
import { HealthBadge } from "../../../shared/ui/health-badge";
import { PageHeader } from "../../../shared/ui/page-header";
import { ProgressBar } from "../../../shared/ui/progress-bar";
import { EmptyState, ErrorState, LoadingState } from "../../../shared/ui/state-panel";
import { QuickAddDialog } from "../../tasks/components/quick-add-dialog";
import { CreateProjectDialog } from "../components/create-project-dialog";

export function ProjectsPage() {
  const { snapshot, isLoading, isError, error, refetch } = useWorkspace();
  const [query, setQuery] = useState("");
  const [health, setHealth] = useState("all");

  const projects = useMemo(() => {
    const source = snapshot?.projects ?? [];
    return source.filter((project) => {
      const matchesQuery = `${project.name} ${project.code} ${project.teamName}`.toLowerCase().includes(query.toLowerCase());
      const matchesHealth = health === "all" || project.health === health;
      return matchesQuery && matchesHealth;
    });
  }, [snapshot?.projects, query, health]);

  if (isLoading) return <LoadingState label="Cargando portfolio…" />;
  if (isError || !snapshot) return <ErrorState message={error?.message ?? "No fue posible leer los proyectos."} onRetry={refetch} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Portfolio"
        title="Proyectos"
        description="Compara salud, progreso, fechas y esfuerzo sin perder el contexto de la organización activa."
        actions={<div className="flex flex-wrap gap-2"><CreateProjectDialog /><QuickAddDialog /></div>}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-card" aria-label="Filtros del portfolio">
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Buscar proyectos</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por proyecto, código o equipo…"
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"
            />
          </label>
          <label className="relative sm:w-56">
            <span className="sr-only">Filtrar por salud</span>
            <Filter className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" aria-hidden="true" />
            <select
              value={health}
              onChange={(event) => setHealth(event.target.value)}
              className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold text-ink-700 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
            >
              <option value="all">Todos los estados</option>
              <option value="green">En buen estado</option>
              <option value="yellow">Atención</option>
              <option value="red">En riesgo</option>
              <option value="unknown">Sin datos</option>
            </select>
          </label>
        </div>
      </section>

      {projects.length === 0 ? (
        <EmptyState
          title={snapshot.projects.length === 0 ? "Aún no tienes proyectos" : "No hay proyectos que coincidan"}
          description={snapshot.projects.length === 0 ? "Crea tu primer proyecto. Después podrás agregar tareas y Yetly empezará a calcular progreso, salud y carga." : "Prueba con otro término o limpia el filtro de salud para ampliar los resultados."}
          action={snapshot.projects.length === 0 ? <CreateProjectDialog /> : undefined}
        />
      ) : (
        <>
          <section className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card md:block" aria-label="Tabla de proyectos">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-black uppercase tracking-[0.08em] text-ink-500">
                    <th className="px-5 py-3">Proyecto</th>
                    <th className="px-4 py-3">Owner</th>
                    <th className="px-4 py-3">Salud</th>
                    <th className="px-4 py-3">Progreso</th>
                    <th className="px-4 py-3">Objetivo</th>
                    <th className="px-4 py-3">Tiempo real</th>
                    <th className="px-4 py-3">Equipo</th>
                    <th className="w-12 px-3 py-3"><span className="sr-only">Abrir</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {projects.map((project) => (
                    <tr key={project.id} className="group hover:bg-brand-50/35">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="h-9 w-1.5 rounded-full" style={{ backgroundColor: project.accent }} aria-hidden="true" />
                          <div className="min-w-0">
                            <Link to={`/projects/${project.id}/list`} className="font-bold text-ink-950 hover:text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200">
                              {project.name}
                            </Link>
                            <p className="mt-0.5 text-xs font-semibold text-ink-500">{project.code}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Avatar person={project.owner} size="sm" />
                          <span className="text-sm font-semibold text-ink-700">{project.owner.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <HealthBadge health={project.health} />
                        <p className="mt-1 max-w-52 text-[11px] leading-4 text-ink-500">{project.healthReason}</p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex min-w-36 items-center gap-2">
                          <ProgressBar value={project.progress} className="flex-1" label={`Progreso de ${project.name}`} />
                          <span className="text-xs font-black tabular-nums text-ink-700">{project.progress}%</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-ink-700">{project.targetDate}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-ink-700">{formatMinutes(project.actualMinutes)}</td>
                      <td className="px-4 py-4 text-sm font-semibold text-ink-700">{project.teamName}</td>
                      <td className="px-3 py-4">
                        <Link to={`/projects/${project.id}/list`} className="grid h-10 w-10 place-items-center rounded-xl text-ink-500 hover:bg-white hover:text-brand-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200" aria-label={`Abrir ${project.name}`}>
                          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-3 md:hidden" aria-label="Proyectos">
            {projects.map((project) => (
              <article key={project.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-10 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: project.accent }} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-ink-500">{project.code}</p>
                        <h2 className="mt-0.5 font-bold text-ink-950">{project.name}</h2>
                      </div>
                      <HealthBadge health={project.health} compact />
                    </div>
                    <p className="mt-2 text-xs leading-5 text-ink-500">{project.healthReason}</p>
                    <div className="mt-4 flex items-center gap-2">
                      <ProgressBar value={project.progress} className="flex-1" label={`Progreso de ${project.name}`} />
                      <span className="text-xs font-black text-ink-700">{project.progress}%</span>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Avatar person={project.owner} size="sm" />
                        <span className="text-xs font-semibold text-ink-600">{project.targetDate}</span>
                      </div>
                      <Link to={`/projects/${project.id}/list`} className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm font-bold text-brand-700 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200">
                        Abrir <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </section>
        </>
      )}
    </div>
  );
}

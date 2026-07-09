import { Clock3, PlusCircle, TimerReset } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { useWorkspace } from "../../../app/providers/app-providers";
import { formatMinutes } from "../../../shared/lib/format";
import { Button } from "../../../shared/ui/button";
import { PageHeader } from "../../../shared/ui/page-header";
import { EmptyState, ErrorState, LoadingState } from "../../../shared/ui/state-panel";

export function TimesheetsPage() {
  const { snapshot, isLoading, isError, error, refetch, createTimeEntry, stopTimer, isMutating } = useWorkspace();
  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [workDate, setWorkDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState("1");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");

  const tasks = useMemo(
    () => snapshot?.tasks.filter((task) => !projectId || task.projectId === projectId) ?? [],
    [snapshot?.tasks, projectId],
  );

  if (isLoading) return <LoadingState label="Cargando registro de tiempo…" />;
  if (isError || !snapshot) return <ErrorState message={error?.message ?? "No fue posible cargar el timesheet."} onRetry={refetch} />;

  const weeklyMinutes = snapshot.weeklyTime.reduce((total, point) => total + point.minutes, 0);
  const projectById = new Map(snapshot.projects.map((project) => [project.id, project]));
  const taskById = new Map(snapshot.tasks.map((task) => [task.id, task]));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    setSuccess("");
    const parsedHours = Number(hours);
    if (!projectId) {
      setFormError("Selecciona un proyecto.");
      return;
    }
    if (!Number.isFinite(parsedHours) || parsedHours <= 0) {
      setFormError("Ingresa una duración mayor que cero.");
      return;
    }
    try {
      await createTimeEntry({
        projectId,
        taskId: taskId || undefined,
        workDate,
        durationMinutes: Math.round(parsedHours * 60),
        note,
      });
      setHours("1");
      setNote("");
      setTaskId("");
      setSuccess("Tiempo registrado correctamente.");
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "No fue posible registrar tiempo.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tiempo"
        title="Timesheets"
        description="Registra horas reales. Los totales y reportes se recalculan desde tus entradas persistidas."
        actions={snapshot.activeTimer ? (
          <Button onClick={() => void stopTimer()} disabled={isMutating}><TimerReset className="h-4 w-4" aria-hidden="true" /> Detener timer</Button>
        ) : undefined}
      />

      {snapshot.projects.length === 0 ? (
        <EmptyState title="Aún no puedes registrar tiempo" description="Crea un proyecto primero. Luego podrás registrar horas manuales o iniciar un timer desde una tarea." />
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6" aria-labelledby="manual-time-heading">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><PlusCircle className="h-5 w-5" aria-hidden="true" /></span>
            <div>
              <h2 id="manual-time-heading" className="font-black text-ink-950">Registro manual</h2>
              <p className="text-xs text-ink-500">Se guarda inmediatamente en el modo de datos activo.</p>
            </div>
          </div>

          <form className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5" onSubmit={submit}>
            <label className="block xl:col-span-1">
              <span className="text-xs font-black text-ink-600">Proyecto</span>
              <select value={projectId} onChange={(event) => { setProjectId(event.target.value); setTaskId(""); }} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100">
                <option value="">Selecciona…</option>
                {snapshot.projects.map((project) => <option key={project.id} value={project.id}>{project.code} · {project.name}</option>)}
              </select>
            </label>
            <label className="block xl:col-span-1">
              <span className="text-xs font-black text-ink-600">Tarea opcional</span>
              <select value={taskId} onChange={(event) => setTaskId(event.target.value)} disabled={!projectId} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none disabled:bg-slate-100 focus:border-brand-500 focus:ring-4 focus:ring-brand-100">
                <option value="">Sin tarea</option>
                {tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-black text-ink-600">Fecha</span>
              <input type="date" value={workDate} onChange={(event) => setWorkDate(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" />
            </label>
            <label className="block">
              <span className="text-xs font-black text-ink-600">Duración (h)</span>
              <input type="number" min="0.25" step="0.25" value={hours} onChange={(event) => setHours(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" />
            </label>
            <div className="flex items-end"><Button type="submit" className="w-full" disabled={isMutating}>Registrar</Button></div>
            <label className="block md:col-span-2 xl:col-span-5">
              <span className="text-xs font-black text-ink-600">Nota</span>
              <input value={note} onChange={(event) => setNote(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" placeholder="Ej. Revisión con cliente" />
            </label>
          </form>
          {formError && <p className="mt-4 rounded-xl bg-danger-50 px-4 py-3 text-sm font-bold text-danger-700" role="alert">{formError}</p>}
          {success && <p className="mt-4 rounded-xl bg-success-50 px-4 py-3 text-sm font-bold text-success-700" role="status" aria-live="polite">{success}</p>}
        </section>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,.6fr)]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card" aria-labelledby="entries-heading">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 id="entries-heading" className="font-black text-ink-950">Entradas registradas</h2>
            <p className="mt-1 text-xs text-ink-500">{snapshot.timeEntries.length} registro{snapshot.timeEntries.length === 1 ? "" : "s"} real{snapshot.timeEntries.length === 1 ? "" : "es"}</p>
          </div>
          {snapshot.timeEntries.length === 0 ? (
            <div className="p-5"><EmptyState title="Todavía no hay horas" description="Registra tiempo manualmente o inicia un timer desde una tarea." /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-ink-500">
                  <tr><th className="px-5 py-3">Fecha</th><th className="px-4 py-3">Proyecto</th><th className="px-4 py-3">Tarea</th><th className="px-4 py-3">Fuente</th><th className="px-4 py-3 text-right">Duración</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {snapshot.timeEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-5 py-3 font-semibold text-ink-700">{entry.workDate}</td>
                      <td className="px-4 py-3 font-bold text-ink-950">{projectById.get(entry.projectId)?.name ?? "Proyecto eliminado"}</td>
                      <td className="px-4 py-3 text-ink-600">{entry.taskId ? taskById.get(entry.taskId)?.title ?? "Tarea eliminada" : "—"}</td>
                      <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-ink-600">{entry.source === "timer" ? "Timer" : "Manual"}</span></td>
                      <td className="px-4 py-3 text-right font-black text-ink-950">{formatMinutes(entry.durationMinutes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6" aria-labelledby="weekly-summary-heading">
          <div className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-brand-600" aria-hidden="true" /><h2 id="weekly-summary-heading" className="font-black text-ink-950">Resumen semanal</h2></div>
          <p className="mt-3 text-4xl font-black tracking-[-0.04em] text-ink-950">{formatMinutes(weeklyMinutes)}</p>
          <p className="mt-1 text-sm font-semibold text-ink-500">Tiempo registrado</p>
          <div className="mt-6 space-y-3">
            {snapshot.weeklyTime.map((point) => (
              <div key={point.day}>
                <div className="mb-1.5 flex justify-between text-xs font-bold"><span className="text-ink-500">{point.day}</span><span className="text-ink-700">{formatMinutes(point.minutes)}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.min(100, (point.minutes / 480) * 100)}%` }} /></div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { useMemo, useState } from "react";
import type { TaskSummary, WorkloadPerson } from "../../../application/ports/workspace-port";
import { cn } from "../../../shared/lib/cn";
import { formatMinutes } from "../../../shared/lib/format";
import { Avatar } from "../../../shared/ui/avatar";
import { Button } from "../../../shared/ui/button";

function atMidnight(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseDate(value?: string) {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return year && month && day ? new Date(year, month - 1, day) : undefined;
}

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function mondayOf(date: Date) {
  const result = atMidnight(date);
  const weekday = result.getDay() || 7;
  result.setDate(result.getDate() - weekday + 1);
  return result;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function workingDates(start: Date, end: Date) {
  const dates: Date[] = [];
  let cursor = atMidnight(start);
  const limit = atMidnight(end);
  let guard = 0;
  while (cursor <= limit && guard < 370) {
    if (cursor.getDay() !== 0 && cursor.getDay() !== 6) dates.push(new Date(cursor));
    cursor = addDays(cursor, 1);
    guard += 1;
  }
  return dates.length ? dates : [limit];
}

type CellLoad = { minutes: number; tasks: TaskSummary[] };

function allocationForTask(task: TaskSummary, today: Date) {
  const remaining = Math.max(0, task.estimateMinutes - task.actualMinutes);
  if (!remaining || task.completed) return [] as Array<{ date: string; minutes: number }>;
  const parsedStart = parseDate(task.startDate) ?? parseDate(task.dueDate) ?? today;
  const parsedEnd = parseDate(task.dueDate) ?? parsedStart;
  let start = parsedStart <= parsedEnd ? parsedStart : parsedEnd;
  let end = parsedStart <= parsedEnd ? parsedEnd : parsedStart;
  if (end < today) start = end = today;
  const dates = workingDates(start, end);
  const minutes = remaining / dates.length;
  return dates.map((date) => ({ date: isoDate(date), minutes }));
}

function cellTone(utilization: number) {
  if (utilization > 100) return { fill: "bg-danger-500", surface: "bg-danger-50", text: "text-danger-800" };
  if (utilization > 80) return { fill: "bg-warning-500", surface: "bg-warning-50", text: "text-warning-900" };
  return { fill: "bg-emerald-500", surface: "bg-emerald-50", text: "text-emerald-900" };
}

export function ProjectLoadsView({
  tasks,
  workload,
  onOpenTask,
}: {
  tasks: TaskSummary[];
  workload: WorkloadPerson[];
  onOpenTask: (task: TaskSummary) => void;
}) {
  const today = useMemo(() => atMidnight(new Date()), []);
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [selected, setSelected] = useState<{ personId: string; date: string }>();
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const visibleDates = useMemo(() => new Set(days.map(isoDate)), [days]);

  const people = useMemo(() => {
    const assigned = new Set(tasks.flatMap((task) => task.assignees.map((person) => person.id)));
    return workload.filter((item) => assigned.has(item.person.id));
  }, [tasks, workload]);

  const matrix = useMemo(() => {
    const cells = new Map<string, CellLoad>();
    for (const task of tasks) {
      for (const allocation of allocationForTask(task, today)) {
        if (!visibleDates.has(allocation.date)) continue;
        for (const assignee of task.assignees) {
          const key = `${assignee.id}:${allocation.date}`;
          const current = cells.get(key) ?? { minutes: 0, tasks: [] };
          current.minutes += allocation.minutes;
          if (!current.tasks.some((item) => item.id === task.id)) current.tasks.push(task);
          cells.set(key, current);
        }
      }
    }
    return cells;
  }, [tasks, today, visibleDates]);

  const selectedPerson = people.find((item) => item.person.id === selected?.personId);
  const selectedCell = selected ? matrix.get(`${selected.personId}:${selected.date}`) : undefined;
  const weekdayLabel = new Intl.DateTimeFormat("es-CL", { weekday: "short" });
  const monthLabel = new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" });
  const dayLabel = new Intl.DateTimeFormat("es-CL", { day: "numeric" });
  const rangeLabel = `${days[0].toLocaleDateString("es-CL", { day: "numeric", month: "short" })} – ${days[6].toLocaleDateString("es-CL", { day: "numeric", month: "short" })}`;

  if (!people.length) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
        <Users className="mx-auto h-8 w-8 text-ink-300" />
        <h2 className="mt-3 font-black text-ink-950">No hay carga para mostrar</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-ink-600">Asigna responsables y estimaciones a las tareas del proyecto para construir la matriz Loads.</p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white shadow-card">
        <header className="flex flex-col gap-4 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-brand-700">Loads · capacidad diaria</p>
            <h2 className="mt-1 text-xl font-black capitalize text-ink-950">{monthLabel.format(weekStart)}</h2>
            <p className="mt-1 text-xs font-semibold text-ink-500">{rangeLabel} · el esfuerzo restante se distribuye entre días laborables.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => setWeekStart((current) => addDays(current, -7))} aria-label="Semana anterior"><ChevronLeft className="h-4 w-4" /></Button>
            <Button type="button" variant="secondary" onClick={() => setWeekStart(mondayOf(new Date()))}>Hoy</Button>
            <Button type="button" variant="secondary" onClick={() => setWeekStart((current) => addDays(current, 7))} aria-label="Semana siguiente"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </header>

        <div className="overflow-x-auto">
          <div className="min-w-[1050px]">
            <div className="grid grid-cols-[250px_repeat(7,minmax(110px,1fr))] border-b border-slate-200 bg-slate-50/80">
              <div className="sticky left-0 z-10 flex items-center gap-2 border-r border-slate-200 bg-slate-50/95 px-4 py-3 text-xs font-black uppercase tracking-wider text-ink-500"><Users className="h-4 w-4" /> Responsables</div>
              {days.map((day) => {
                const weekend = day.getDay() === 0 || day.getDay() === 6;
                const current = isoDate(day) === isoDate(today);
                return <div key={isoDate(day)} className={cn("border-r border-slate-200 px-3 py-3 text-center last:border-r-0", weekend && "bg-slate-100/80")}><p className="text-[11px] font-black uppercase capitalize text-ink-500">{weekdayLabel.format(day)}</p><p className={cn("mx-auto mt-1 grid h-7 w-7 place-items-center rounded-lg text-sm font-black", current ? "bg-brand-600 text-white" : "text-ink-900")}>{dayLabel.format(day)}</p></div>;
              })}
            </div>

            {people.map((item) => {
              const dailyCapacity = Math.max(1, item.capacityMinutes / 5);
              const visibleMinutes = days.reduce((total, day) => total + (matrix.get(`${item.person.id}:${isoDate(day)}`)?.minutes ?? 0), 0);
              const weeklyUse = Math.round((visibleMinutes / item.capacityMinutes) * 100);
              return (
                <div key={item.person.id} className="grid grid-cols-[250px_repeat(7,minmax(110px,1fr))] border-b border-slate-100 last:border-b-0">
                  <div className="sticky left-0 z-10 border-r border-slate-200 bg-white px-4 py-4">
                    <div className="flex items-center gap-3"><Avatar person={item.person} size="lg" /><div className="min-w-0"><p className="truncate text-sm font-black text-ink-950">{item.person.name}</p><p className="mt-0.5 text-xs text-ink-500">{formatMinutes(Math.round(visibleMinutes))} / {formatMinutes(item.capacityMinutes)}</p></div></div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={cn("h-full rounded-full", weeklyUse > 100 ? "bg-danger-500" : weeklyUse > 80 ? "bg-warning-500" : "bg-brand-600")} style={{ width: `${Math.min(100, weeklyUse)}%` }} /></div>
                  </div>
                  {days.map((day) => {
                    const date = isoDate(day);
                    const weekend = day.getDay() === 0 || day.getDay() === 6;
                    const cell = matrix.get(`${item.person.id}:${date}`) ?? { minutes: 0, tasks: [] };
                    const utilization = weekend ? (cell.minutes ? 101 : 0) : Math.round((cell.minutes / dailyCapacity) * 100);
                    const tone = cellTone(utilization);
                    const active = selected?.personId === item.person.id && selected.date === date;
                    return (
                      <button key={date} type="button" onClick={() => setSelected({ personId: item.person.id, date })} className={cn("relative h-32 overflow-hidden border-r border-slate-100 p-2 text-left last:border-r-0 focus:z-10 focus:outline-none focus:ring-4 focus:ring-inset focus:ring-brand-200", weekend && !cell.minutes && "bg-[repeating-linear-gradient(135deg,#f8fafc,#f8fafc_8px,#eef2f7_8px,#eef2f7_16px)]", active && "ring-2 ring-inset ring-brand-500")} aria-label={`${item.person.name}, ${date}: ${formatMinutes(Math.round(cell.minutes))}`}>
                        {cell.minutes > 0 && <><span className={cn("absolute inset-x-2 bottom-2 rounded-lg opacity-90 transition-all", tone.fill)} style={{ height: `${Math.max(18, Math.min(100, utilization))}%` }} /><span className={cn("relative z-[1] block rounded-lg px-2 py-1.5 text-xs font-black", utilization > 65 ? "text-white" : tone.text)}>{formatMinutes(Math.round(cell.minutes))}{utilization > 100 && <span className="mt-0.5 block text-[9px] uppercase tracking-wide">{utilization - 100}% sobre capacidad</span>}</span><span className={cn("absolute inset-x-2 top-2 h-2 rounded-full", tone.surface)} /></>}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {selected && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card" aria-live="polite">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-brand-700">Detalle de carga</p><h2 className="mt-1 font-black text-ink-950">{selectedPerson?.person.name} · {new Date(`${selected.date}T12:00:00`).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}</h2></div><span className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-black text-ink-700">{formatMinutes(Math.round(selectedCell?.minutes ?? 0))}</span></div>
          {selectedCell?.tasks.length ? <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{selectedCell.tasks.map((task) => <button key={task.id} type="button" onClick={() => onOpenTask(task)} className="rounded-xl border border-slate-200 p-3 text-left hover:border-brand-300 hover:bg-brand-50"><p className="text-sm font-black text-ink-950">{task.title}</p><p className="mt-1 text-xs text-ink-500">{task.projectCode} · {formatMinutes(Math.max(0, task.estimateMinutes - task.actualMinutes))} restantes</p></button>)}</div> : <p className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-ink-600"><CalendarDays className="h-4 w-4" /> Sin tareas asignadas para este día.</p>}
          {selectedCell && selectedPerson && selectedCell.minutes > selectedPerson.capacityMinutes / 5 && <p className="mt-4 flex items-center gap-2 rounded-xl bg-danger-50 px-4 py-3 text-sm font-bold text-danger-800"><AlertTriangle className="h-4 w-4" /> La carga supera la capacidad diaria estimada.</p>}
        </section>
      )}
    </div>
  );
}

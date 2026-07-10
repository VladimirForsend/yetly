import {
  CalendarClock,
  CheckCircle2,
  GitBranch,
  Link2,
  Maximize2,
  Minus,
  Move,
  Plus,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import type {
  CreateTaskInput,
  TaskSummary,
  WorkflowConnection,
  WorkflowNodePosition,
} from "../../../application/ports/workspace-port";
import { cn } from "../../../shared/lib/cn";
import { Avatar } from "../../../shared/ui/avatar";

const STAGE_WIDTH = 3600;
const STAGE_HEIGHT = 2400;
const NODE_WIDTH = 280;
const NODE_HEIGHT = 154;

const statusMeta: Record<TaskSummary["status"], { label: string; dot: string; band: string }> = {
  backlog: { label: "Backlog", dot: "bg-slate-400", band: "bg-slate-400" },
  todo: { label: "Por hacer", dot: "bg-blue-500", band: "bg-blue-500" },
  in_progress: { label: "En curso", dot: "bg-brand-600", band: "bg-brand-600" },
  review: { label: "Revisión", dot: "bg-warning-600", band: "bg-warning-600" },
  done: { label: "Completada", dot: "bg-success-600", band: "bg-success-600" },
};

const priorityLabel: Record<TaskSummary["priority"], string> = {
  low: "Baja",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
};

interface Point { x: number; y: number }

interface WorkflowNodixViewProps {
  projectId: string;
  tasks: TaskSummary[];
  positions: WorkflowNodePosition[];
  connections: WorkflowConnection[];
  onOpenTask: (task: TaskSummary) => void;
  onCreateTask: (input: CreateTaskInput) => Promise<TaskSummary>;
  onSavePosition: (projectId: string, taskId: string, x: number, y: number) => Promise<void>;
  onCreateConnection: (projectId: string, sourceTaskId: string, targetTaskId: string) => Promise<void>;
  onDeleteConnection: (connectionId: string) => Promise<void>;
}

function fallbackPosition(index: number): Point {
  return {
    x: 260 + (index % 4) * 370,
    y: 240 + Math.floor(index / 4) * 230,
  };
}

function bezierPath(source: Point, target: Point) {
  const bend = Math.max(90, Math.abs(target.x - source.x) * 0.45);
  return `M ${source.x} ${source.y} C ${source.x + bend} ${source.y}, ${target.x - bend} ${target.y}, ${target.x} ${target.y}`;
}

function findFreePosition(desired: Point, occupied: Point[]): Point {
  let candidate = {
    x: Math.max(30, Math.min(STAGE_WIDTH - NODE_WIDTH - 30, desired.x)),
    y: Math.max(30, Math.min(STAGE_HEIGHT - NODE_HEIGHT - 30, desired.y)),
  };
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const collides = occupied.some((point) =>
      Math.abs(point.x - candidate.x) < NODE_WIDTH + 45 && Math.abs(point.y - candidate.y) < NODE_HEIGHT + 45,
    );
    if (!collides) return candidate;
    candidate = {
      x: candidate.x + NODE_WIDTH + 90,
      y: candidate.y,
    };
    if (candidate.x > STAGE_WIDTH - NODE_WIDTH - 30) {
      candidate.x = 120;
      candidate.y = Math.min(STAGE_HEIGHT - NODE_HEIGHT - 30, candidate.y + NODE_HEIGHT + 80);
    }
  }
  return candidate;
}

export function WorkflowNodixView({
  projectId,
  tasks,
  positions,
  connections,
  onOpenTask,
  onCreateTask,
  onSavePosition,
  onCreateConnection,
  onDeleteConnection,
}: WorkflowNodixViewProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ taskId: string; pointerId: number; offsetX: number; offsetY: number }>();
  const panRef = useRef<{ pointerId: number; startX: number; startY: number; origin: Point }>();
  const [localPositions, setLocalPositions] = useState<Record<string, Point>>({});
  const [pan, setPan] = useState<Point>({ x: 40, y: 30 });
  const [zoom, setZoom] = useState(0.82);
  const [selectedTaskId, setSelectedTaskId] = useState<string>();
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>();
  const [connectingFrom, setConnectingFrom] = useState<string>();
  const [pointerWorld, setPointerWorld] = useState<Point>();
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const persisted = new Map(positions.map((position) => [position.taskId, { x: position.x, y: position.y }]));
    setLocalPositions((current) => {
      const next: Record<string, Point> = {};
      tasks.forEach((task, index) => {
        next[task.id] = persisted.get(task.id) ?? current[task.id] ?? fallbackPosition(index);
      });
      return next;
    });
  }, [positions, tasks]);

  const tasksById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const visibleConnections = useMemo(
    () => connections.filter((connection) => tasksById.has(connection.sourceTaskId) && tasksById.has(connection.targetTaskId)),
    [connections, tasksById],
  );

  function clientToWorld(clientX: number, clientY: number): Point {
    const rect = viewportRef.current?.getBoundingClientRect();
    return {
      x: ((clientX - (rect?.left ?? 0)) - pan.x) / zoom,
      y: ((clientY - (rect?.top ?? 0)) - pan.y) / zoom,
    };
  }

  function changeZoom(nextZoom: number) {
    const next = Math.min(1.8, Math.max(0.42, nextZoom));
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return setZoom(next);
    const center = { x: rect.width / 2, y: rect.height / 2 };
    const worldCenter = { x: (center.x - pan.x) / zoom, y: (center.y - pan.y) / zoom };
    setPan({ x: center.x - worldCenter.x * next, y: center.y - worldCenter.y * next });
    setZoom(next);
  }

  function fitAll() {
    const viewport = viewportRef.current;
    if (!viewport || !tasks.length) {
      setPan({ x: 40, y: 30 });
      setZoom(0.82);
      return;
    }
    const points = tasks.map((task, index) => localPositions[task.id] ?? fallbackPosition(index));
    const minX = Math.min(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxX = Math.max(...points.map((point) => point.x + NODE_WIDTH));
    const maxY = Math.max(...points.map((point) => point.y + NODE_HEIGHT));
    const next = Math.min(1.15, Math.max(0.42, Math.min(
      (viewport.clientWidth - 100) / Math.max(1, maxX - minX),
      (viewport.clientHeight - 100) / Math.max(1, maxY - minY),
    )));
    setZoom(next);
    setPan({
      x: (viewport.clientWidth - (maxX - minX) * next) / 2 - minX * next,
      y: (viewport.clientHeight - (maxY - minY) * next) / 2 - minY * next,
    });
  }

  function startNodeDrag(event: ReactPointerEvent, taskId: string) {
    if (event.button !== 0 || connectingFrom) return;
    event.preventDefault();
    event.stopPropagation();
    const point = clientToWorld(event.clientX, event.clientY);
    const position = localPositions[taskId] ?? { x: 0, y: 0 };
    dragRef.current = {
      taskId,
      pointerId: event.pointerId,
      offsetX: point.x - position.x,
      offsetY: point.y - position.y,
    };
    viewportRef.current?.setPointerCapture(event.pointerId);
    setSelectedTaskId(taskId);
    setSelectedConnectionId(undefined);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || (event.target as HTMLElement).closest("[data-workflow-node]")) return;
    panRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: pan };
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedTaskId(undefined);
    setSelectedConnectionId(undefined);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const world = clientToWorld(event.clientX, event.clientY);
    setPointerWorld(world);
    const drag = dragRef.current;
    if (drag?.pointerId === event.pointerId) {
      setLocalPositions((current) => ({
        ...current,
        [drag.taskId]: {
          x: Math.max(20, Math.min(STAGE_WIDTH - NODE_WIDTH - 20, world.x - drag.offsetX)),
          y: Math.max(20, Math.min(STAGE_HEIGHT - NODE_HEIGHT - 20, world.y - drag.offsetY)),
        },
      }));
      return;
    }
    const activePan = panRef.current;
    if (activePan?.pointerId === event.pointerId) {
      setPan({
        x: activePan.origin.x + event.clientX - activePan.startX,
        y: activePan.origin.y + event.clientY - activePan.startY,
      });
    }
  }

  async function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    dragRef.current = undefined;
    panRef.current = undefined;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const position = localPositions[drag.taskId];
    if (!position) return;
    try {
      await onSavePosition(projectId, drag.taskId, position.x, position.y);
      setMessage("Posición guardada para todo el equipo.");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "No pudimos guardar la posición.");
    }
  }

  async function finishConnection(targetTaskId: string) {
    const sourceTaskId = connectingFrom;
    if (!sourceTaskId) return;
    if (sourceTaskId === targetTaskId) {
      setMessage("Elige otra tarea para completar la conexión.");
      return;
    }
    setConnectingFrom(undefined);
    setPointerWorld(undefined);
    try {
      await onCreateConnection(projectId, sourceTaskId, targetTaskId);
      setMessage("Tareas conectadas.");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "No pudimos conectar las tareas.");
    }
  }

  async function createTask(event: FormEvent) {
    event.preventDefault();
    const title = newTaskTitle.trim();
    if (title.length < 2 || isCreating) return;
    setIsCreating(true);
    setMessage("");
    try {
      const task = await onCreateTask({ projectId, title, status: "todo", priority: "normal" });
      const viewport = viewportRef.current;
      const position = viewport
        ? clientToWorld(viewport.getBoundingClientRect().left + viewport.clientWidth / 2, viewport.getBoundingClientRect().top + viewport.clientHeight / 2)
        : fallbackPosition(tasks.length);
      const placed = findFreePosition(
        { x: position.x - NODE_WIDTH / 2, y: position.y - NODE_HEIGHT / 2 },
        Object.values(localPositions),
      );
      setLocalPositions((current) => ({ ...current, [task.id]: placed }));
      await onSavePosition(projectId, task.id, placed.x, placed.y);
      setNewTaskTitle("");
      setSelectedTaskId(task.id);
      setMessage("Tarea creada en el lienzo.");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "No pudimos crear la tarea.");
    } finally {
      setIsCreating(false);
    }
  }

  async function deleteSelectedConnection() {
    if (!selectedConnectionId) return;
    try {
      await onDeleteConnection(selectedConnectionId);
      setSelectedConnectionId(undefined);
      setMessage("Conexión eliminada.");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "No pudimos eliminar la conexión.");
    }
  }

  const draftSource = connectingFrom ? localPositions[connectingFrom] : undefined;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card" aria-labelledby="workflow-nodix-heading">
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-white p-3 lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-center gap-3 px-1">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink-950 text-white"><GitBranch className="h-5 w-5" aria-hidden="true" /></span>
          <div className="min-w-0">
            <h2 id="workflow-nodix-heading" className="truncate font-black text-ink-950">Workflow Nodix</h2>
            <p className="truncate text-xs font-semibold text-ink-500">Lienzo compartido · {tasks.length} tarea{tasks.length === 1 ? "" : "s"} · {visibleConnections.length} conexión{visibleConnections.length === 1 ? "" : "es"}</p>
          </div>
        </div>

        <form onSubmit={createTask} className="flex min-w-0 flex-1 gap-2 lg:ml-4">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Nombre de la nueva tarea</span>
            <input
              value={newTaskTitle}
              onChange={(event) => setNewTaskTitle(event.target.value)}
              placeholder="Crear una tarea en el lienzo…"
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"
            />
          </label>
          <button disabled={newTaskTitle.trim().length < 2 || isCreating} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-brand-600 px-3 text-sm font-black text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
            <Plus className="h-4 w-4" aria-hidden="true" /> {isCreating ? "Creando…" : "Tarea"}
          </button>
        </form>

        <div className="flex items-center gap-1 self-end lg:self-auto" role="toolbar" aria-label="Controles del lienzo">
          {selectedConnectionId && (
            <button onClick={() => void deleteSelectedConnection()} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-danger-50 px-3 text-xs font-black text-danger-700 hover:bg-red-100" title="Eliminar conexión seleccionada">
              <Trash2 className="h-4 w-4" aria-hidden="true" /> Enlace
            </button>
          )}
          <button onClick={() => changeZoom(zoom - 0.1)} className="grid h-10 w-10 place-items-center rounded-xl text-ink-600 hover:bg-slate-100" aria-label="Alejar"><ZoomOut className="h-4 w-4" /></button>
          <output className="min-w-12 text-center text-xs font-black tabular-nums text-ink-600">{Math.round(zoom * 100)}%</output>
          <button onClick={() => changeZoom(zoom + 0.1)} className="grid h-10 w-10 place-items-center rounded-xl text-ink-600 hover:bg-slate-100" aria-label="Acercar"><ZoomIn className="h-4 w-4" /></button>
          <button onClick={fitAll} className="grid h-10 w-10 place-items-center rounded-xl text-ink-600 hover:bg-slate-100" aria-label="Encuadrar todas las tareas" title="Encuadrar todo"><Maximize2 className="h-4 w-4" /></button>
        </div>
      </div>

      <div
        ref={viewportRef}
        className={cn("relative h-[650px] overflow-hidden bg-[#f7f8fc]", panRef.current ? "cursor-grabbing" : "cursor-grab")}
        style={{ touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => void handlePointerUp(event)}
        onPointerCancel={(event) => void handlePointerUp(event)}
        onWheel={(event) => {
          if (!event.ctrlKey && !event.metaKey) return;
          event.preventDefault();
          changeZoom(zoom + (event.deltaY > 0 ? -0.08 : 0.08));
        }}
      >
        <div
          className="absolute left-0 top-0"
          style={{
            width: STAGE_WIDTH,
            height: STAGE_HEIGHT,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            backgroundImage: "radial-gradient(circle, rgba(92,83,216,.2) 1.25px, transparent 1.25px)",
            backgroundSize: "24px 24px",
          }}
          aria-label="Lienzo abierto de tareas"
        >
          <svg className="absolute inset-0 overflow-visible" width={STAGE_WIDTH} height={STAGE_HEIGHT} aria-hidden="true">
            <defs>
              <marker id="nodix-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#6d63e8" />
              </marker>
            </defs>
            {visibleConnections.map((connection) => {
              const source = localPositions[connection.sourceTaskId];
              const target = localPositions[connection.targetTaskId];
              if (!source || !target) return null;
              const path = bezierPath(
                { x: source.x + NODE_WIDTH, y: source.y + NODE_HEIGHT / 2 },
                { x: target.x, y: target.y + NODE_HEIGHT / 2 },
              );
              const selected = selectedConnectionId === connection.id;
              return (
                <g key={connection.id}>
                  <path d={path} fill="none" stroke="transparent" strokeWidth="18" className="cursor-pointer" onPointerDown={(event) => { event.stopPropagation(); setSelectedConnectionId(connection.id); setSelectedTaskId(undefined); }} />
                  <path d={path} fill="none" stroke={selected ? "#d33f55" : "#6d63e8"} strokeWidth={selected ? 4 : 2.5} strokeLinecap="round" markerEnd="url(#nodix-arrow)" className="pointer-events-none" opacity={selected ? 1 : 0.72} />
                </g>
              );
            })}
            {draftSource && pointerWorld && (
              <path
                d={bezierPath({ x: draftSource.x + NODE_WIDTH, y: draftSource.y + NODE_HEIGHT / 2 }, pointerWorld)}
                fill="none"
                stroke="#6d63e8"
                strokeWidth="3"
                strokeDasharray="8 7"
                markerEnd="url(#nodix-arrow)"
                opacity="0.8"
              />
            )}
          </svg>

          {tasks.map((task, index) => {
            const position = localPositions[task.id] ?? fallbackPosition(index);
            const selected = selectedTaskId === task.id;
            const source = connectingFrom === task.id;
            return (
              <article
                key={task.id}
                data-workflow-node
                data-task-id={task.id}
                className={cn(
                  "absolute select-none rounded-2xl border bg-white shadow-[0_14px_40px_rgba(23,26,43,.12)] transition-[box-shadow,border-color]",
                  selected ? "border-brand-500 ring-4 ring-brand-100" : "border-slate-200 hover:border-brand-200",
                  source && "ring-4 ring-brand-200",
                )}
                style={{ width: NODE_WIDTH, height: NODE_HEIGHT, transform: `translate(${position.x}px, ${position.y}px)` }}
                onDoubleClick={() => onOpenTask(task)}
                onClick={() => {
                  if (connectingFrom && connectingFrom !== task.id) {
                    void finishConnection(task.id);
                    return;
                  }
                  setSelectedTaskId(task.id);
                  setSelectedConnectionId(undefined);
                }}
              >
                <span className={cn("absolute bottom-4 left-0 top-4 w-1.5 rounded-r-full", statusMeta[task.status].band)} aria-hidden="true" />
                <button
                  className="flex h-full w-full cursor-grab flex-col p-4 pl-5 text-left active:cursor-grabbing"
                  onPointerDown={(event) => startNodeDrag(event, task.id)}
                  type="button"
                  aria-label={`Mover ${task.title}. Doble clic para abrir.`}
                >
                  <div className="flex w-full items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-black leading-5 text-ink-950">{task.title}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-wide text-ink-500">
                        <span className="inline-flex items-center gap-1"><span className={cn("h-2 w-2 rounded-full", statusMeta[task.status].dot)} />{statusMeta[task.status].label}</span>
                        <span>·</span>
                        <span>{priorityLabel[task.priority]}</span>
                      </div>
                    </div>
                    {task.completed && <CheckCircle2 className="h-5 w-5 shrink-0 text-success-600" aria-label="Completada" />}
                  </div>
                  <div className="mt-auto flex w-full items-end justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      {task.assignees[0] ? <Avatar person={task.assignees[0]} size="sm" /> : <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-xs font-black text-ink-500">?</span>}
                      <span className="truncate text-[11px] font-bold text-ink-500">{task.assignees[0]?.name ?? "Sin asignar"}</span>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold text-ink-500"><CalendarClock className="h-3.5 w-3.5" />{task.dueDate ?? "Sin fecha"}</span>
                  </div>
                </button>

                <button
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => { event.stopPropagation(); void finishConnection(task.id); }}
                  className={cn(
                    "absolute -left-3 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full border-2 border-white shadow-md transition",
                    connectingFrom && connectingFrom !== task.id ? "scale-110 bg-brand-600 text-white" : "bg-slate-300 text-white",
                  )}
                  aria-label={`Conectar hacia ${task.title}`}
                  title="Entrada de conexión"
                ><Minus className="h-3.5 w-3.5" /></button>
                <button
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    setConnectingFrom((current) => current === task.id ? undefined : task.id);
                    setSelectedTaskId(task.id);
                    setMessage(currentMessage(connectingFrom === task.id));
                  }}
                  className={cn(
                    "absolute -right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full border-2 border-white text-white shadow-md transition hover:scale-110",
                    source ? "bg-brand-700 ring-4 ring-brand-200" : "bg-brand-600",
                  )}
                  aria-label={`Iniciar conexión desde ${task.title}`}
                  title="Crear conexión"
                ><Link2 className="h-3.5 w-3.5" /></button>
              </article>
            );
          })}
        </div>

        {!tasks.length && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center p-6">
            <div className="max-w-sm rounded-3xl border border-dashed border-brand-200 bg-white/90 p-8 text-center shadow-card backdrop-blur">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-700"><GitBranch className="h-7 w-7" /></span>
              <h3 className="mt-4 text-lg font-black text-ink-950">Tu workflow comienza aquí</h3>
              <p className="mt-2 text-sm leading-6 text-ink-500">Escribe arriba el nombre de la primera tarea. Aparecerá como nodo en el centro del lienzo.</p>
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute bottom-4 left-4 flex max-w-[calc(100%-2rem)] items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-[11px] font-bold text-ink-500 shadow-card backdrop-blur">
          <Move className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
          <span className="truncate">Arrastra tareas · mueve el fondo · conector derecho → entrada izquierda · doble clic abre la tarea</span>
        </div>
        {message && <div className="absolute right-4 top-4 max-w-sm rounded-xl bg-ink-950 px-4 py-3 text-xs font-bold text-white shadow-float" role="status">{message}</div>}
      </div>
    </section>
  );
}

function currentMessage(cancelled: boolean) {
  return cancelled ? "Conexión cancelada." : "Ahora selecciona la entrada izquierda de otra tarea.";
}

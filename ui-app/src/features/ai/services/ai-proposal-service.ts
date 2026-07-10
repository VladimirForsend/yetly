import type {
  CreateTaskInput,
  ProjectStatus,
  TaskMode,
  TaskStatus,
  Priority,
  UpdateProjectInput,
  UpdateTaskInput,
  WorkspaceSnapshot,
} from "../../../application/ports/workspace-port";
import type { AiAction, AiProposal } from "../types";

const taskStatuses: TaskStatus[] = ["backlog", "todo", "in_progress", "review", "done"];
const priorities: Priority[] = ["low", "normal", "high", "urgent"];
const modes: TaskMode[] = ["standard", "checklist", "message"];
const projectStatuses: ProjectStatus[] = ["planned", "active", "on_hold", "completed"];

export const ollamaProposalTool = {
  type: "function",
  function: {
    name: "propose_yetly_changes",
    description: "Prepara cambios revisables para Yetly. Nunca ejecuta cambios; el usuario debe confirmarlos.",
    parameters: {
      type: "object",
      required: ["summary", "actions"],
      properties: {
        summary: { type: "string" },
        actions: {
          type: "array",
          items: {
            type: "object",
            required: ["type"],
            properties: {
              type: { type: "string", enum: ["create_task", "update_task", "update_project", "create_workflow_connection", "delete_workflow_connection"] },
              clientRef: { type: "string" },
              title: { type: "string" },
              description: { type: "string" },
              taskId: { type: "string" },
              projectId: { type: "string" },
              connectionId: { type: "string" },
              sourceRef: { type: "string" },
              targetRef: { type: "string" },
              nearTaskId: { type: "string" },
              changes: { type: "object" },
              status: { type: "string" },
              priority: { type: "string" },
              dueDate: { type: "string" },
              startDate: { type: "string" },
              estimateMinutes: { type: "number" },
              assigneeId: { type: "string" },
              mode: { type: "string" },
            },
          },
        },
      },
    },
  },
};

function record(value: unknown): Record<string, any> | null {
  if (typeof value === "string") {
    try { return record(JSON.parse(value)); } catch { return null; }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : null;
}

function text(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : undefined; }
function date(value: unknown) { const result = text(value); return result && /^\d{4}-\d{2}-\d{2}$/.test(result) ? result : undefined; }
function actionId(index: number) { return `ai-action-${index + 1}-${crypto.randomUUID()}`; }

function taskChanges(value: unknown): UpdateTaskInput {
  const source = record(value) ?? {};
  const changes: UpdateTaskInput = {};
  if (text(source.title)) changes.title = text(source.title);
  if (typeof source.description === "string") changes.description = source.description;
  if (taskStatuses.includes(source.status)) changes.status = source.status;
  if (priorities.includes(source.priority)) changes.priority = source.priority;
  if (date(source.dueDate)) changes.dueDate = date(source.dueDate);
  if (date(source.startDate)) changes.startDate = date(source.startDate);
  if (Number.isFinite(source.estimateMinutes)) changes.estimateMinutes = Math.max(0, Math.round(source.estimateMinutes));
  if (typeof source.assigneeId === "string") changes.assigneeId = source.assigneeId;
  if (modes.includes(source.mode)) changes.mode = source.mode;
  return changes;
}

export function parseAiProposal(argumentsValue: unknown): AiProposal | undefined {
  const payload = record(argumentsValue);
  if (!payload || !Array.isArray(payload.actions)) return undefined;
  const actions: AiAction[] = [];
  payload.actions.slice(0, 20).forEach((rawValue: unknown, index: number) => {
    const raw = record(rawValue);
    if (!raw) return;
    const id = actionId(index);
    if (raw.type === "create_task" && text(raw.title)) {
      actions.push({
        id,
        type: "create_task",
        clientRef: text(raw.clientRef) ?? `new-task-${index + 1}`,
        title: text(raw.title)!,
        description: typeof raw.description === "string" ? raw.description : undefined,
        status: taskStatuses.includes(raw.status) ? raw.status : "todo",
        priority: priorities.includes(raw.priority) ? raw.priority : "normal",
        dueDate: date(raw.dueDate),
        startDate: date(raw.startDate),
        estimateMinutes: Number.isFinite(raw.estimateMinutes) ? Math.max(0, Math.round(raw.estimateMinutes)) : undefined,
        assigneeId: text(raw.assigneeId),
        mode: modes.includes(raw.mode) ? raw.mode : "standard",
        nearTaskId: text(raw.nearTaskId),
      });
    } else if (raw.type === "update_task" && text(raw.taskId)) {
      const changes = taskChanges(raw.changes ?? raw);
      if (Object.keys(changes).length) actions.push({ id, type: "update_task", taskId: text(raw.taskId)!, changes });
    } else if (raw.type === "update_project" && text(raw.projectId)) {
      const source = record(raw.changes) ?? raw;
      const changes: { targetDate?: string; status?: ProjectStatus } = {};
      if (date(source.targetDate)) changes.targetDate = date(source.targetDate);
      if (projectStatuses.includes(source.status)) changes.status = source.status;
      if (Object.keys(changes).length) actions.push({ id, type: "update_project", projectId: text(raw.projectId)!, changes });
    } else if (raw.type === "create_workflow_connection" && text(raw.projectId) && text(raw.sourceRef) && text(raw.targetRef)) {
      actions.push({ id, type: "create_workflow_connection", projectId: text(raw.projectId)!, sourceRef: text(raw.sourceRef)!, targetRef: text(raw.targetRef)! });
    } else if (raw.type === "delete_workflow_connection" && text(raw.projectId) && text(raw.connectionId)) {
      actions.push({ id, type: "delete_workflow_connection", projectId: text(raw.projectId)!, connectionId: text(raw.connectionId)! });
    }
  });
  if (!actions.length) return undefined;
  return { summary: text(payload.summary) ?? "Propuesta preparada por Yetly AI", actions, status: "pending" };
}

export interface AiApplyDependencies {
  createTask(input: CreateTaskInput): Promise<{ id: string }>;
  updateTask(taskId: string, input: UpdateTaskInput): Promise<void>;
  updateProject(projectId: string, input: UpdateProjectInput): Promise<void>;
  createWorkflowConnection(projectId: string, sourceTaskId: string, targetTaskId: string): Promise<void>;
  deleteWorkflowConnection(connectionId: string): Promise<void>;
  saveWorkflowNodePosition(projectId: string, taskId: string, x: number, y: number): Promise<void>;
}

export async function applyAiProposal(input: {
  proposal: AiProposal;
  selectedActionIds: Set<string>;
  snapshot: WorkspaceSnapshot;
  scopeProjectId: string;
  dependencies: AiApplyDependencies;
}): Promise<AiProposal> {
  const chosen = input.proposal.actions.filter((action) => input.selectedActionIds.has(action.id));
  const results: NonNullable<AiProposal["results"]> = [];
  const createdRefs = new Map<string, string>();
  const project = input.snapshot.projects.find((item) => item.id === input.scopeProjectId);
  const canEditProject = Boolean(project && (project.owner.id === input.snapshot.currentUser.id || ["owner", "admin"].includes(input.snapshot.activeOrganization.memberRole ?? "")));

  for (const action of chosen.filter((item) => item.type === "create_task")) {
    try {
      if (action.startDate && action.dueDate && action.dueDate < action.startDate) throw new Error("La fecha límite propuesta es anterior al inicio.");
      if (action.assigneeId && !input.snapshot.workload.some((item) => item.person.id === action.assigneeId)) throw new Error("El responsable propuesto no pertenece a la organización.");
      const created = await input.dependencies.createTask({
        projectId: input.scopeProjectId,
        title: action.title,
        description: action.description,
        status: action.status ?? "todo",
        priority: action.priority ?? "normal",
        dueDate: action.dueDate,
        startDate: action.startDate,
        estimateMinutes: action.estimateMinutes,
        assigneeId: action.assigneeId,
        mode: action.mode,
      });
      createdRefs.set(action.clientRef, created.id);
      const near = action.nearTaskId ? input.snapshot.workflowNodePositions.find((item) => item.taskId === action.nearTaskId) : undefined;
      await input.dependencies.saveWorkflowNodePosition(input.scopeProjectId, created.id, (near?.x ?? 240) + 360, near?.y ?? 220);
      results.push({ actionId: action.id, ok: true, message: `Tarea creada: ${action.title}` });
    } catch (error) {
      results.push({ actionId: action.id, ok: false, message: error instanceof Error ? error.message : "No se pudo crear la tarea." });
    }
  }

  for (const action of chosen.filter((item) => item.type === "update_task")) {
    try {
      const task = input.snapshot.tasks.find((item) => item.id === action.taskId && item.projectId === input.scopeProjectId);
      if (!task) throw new Error("La tarea ya no existe en este proyecto.");
      if (!task.canEdit) throw new Error(`No tienes permiso para modificar ${task.title}.`);
      if (action.changes.assigneeId && !input.snapshot.workload.some((item) => item.person.id === action.changes.assigneeId)) throw new Error("El responsable propuesto no pertenece a la organización.");
      const start = action.changes.startDate ?? task.startDate;
      const due = action.changes.dueDate ?? task.dueDate;
      if (start && due && due < start) throw new Error("La fecha límite no puede ser anterior al inicio.");
      await input.dependencies.updateTask(action.taskId, action.changes);
      results.push({ actionId: action.id, ok: true, message: `Tarea actualizada: ${task.title}` });
    } catch (error) {
      results.push({ actionId: action.id, ok: false, message: error instanceof Error ? error.message : "No se pudo actualizar la tarea." });
    }
  }

  for (const action of chosen.filter((item) => item.type === "update_project")) {
    try {
      if (action.projectId !== input.scopeProjectId || !canEditProject) throw new Error("No tienes permiso para modificar la planificación del proyecto.");
      await input.dependencies.updateProject(action.projectId, action.changes);
      results.push({ actionId: action.id, ok: true, message: "Planificación del proyecto actualizada." });
    } catch (error) {
      results.push({ actionId: action.id, ok: false, message: error instanceof Error ? error.message : "No se pudo actualizar el proyecto." });
    }
  }

  for (const action of chosen.filter((item) => item.type === "delete_workflow_connection")) {
    try {
      const connection = input.snapshot.workflowConnections.find((item) => item.id === action.connectionId && item.projectId === input.scopeProjectId);
      if (!connection) throw new Error("La conexión ya no existe en este proyecto.");
      await input.dependencies.deleteWorkflowConnection(action.connectionId);
      results.push({ actionId: action.id, ok: true, message: "Conexión Nodix eliminada." });
    } catch (error) {
      results.push({ actionId: action.id, ok: false, message: error instanceof Error ? error.message : "No se pudo eliminar la conexión." });
    }
  }

  for (const action of chosen.filter((item) => item.type === "create_workflow_connection")) {
    try {
      if (action.projectId !== input.scopeProjectId) throw new Error("La conexión no pertenece al proyecto seleccionado.");
      const resolve = (reference: string) => createdRefs.get(reference) ?? reference;
      const sourceId = resolve(action.sourceRef);
      const targetId = resolve(action.targetRef);
      const existingIds = new Set([...input.snapshot.tasks.filter((task) => task.projectId === input.scopeProjectId).map((task) => task.id), ...createdRefs.values()]);
      if (!existingIds.has(sourceId) || !existingIds.has(targetId)) throw new Error("Una de las tareas de la conexión no existe.");
      await input.dependencies.createWorkflowConnection(input.scopeProjectId, sourceId, targetId);
      results.push({ actionId: action.id, ok: true, message: "Conexión Nodix creada." });
    } catch (error) {
      results.push({ actionId: action.id, ok: false, message: error instanceof Error ? error.message : "No se pudo crear la conexión." });
    }
  }

  const successful = results.filter((result) => result.ok).length;
  const status = successful === results.length && results.length ? "applied" : successful ? "partial" : "partial";
  return { ...input.proposal, status, results };
}

export function describeAiAction(action: AiAction, snapshot: WorkspaceSnapshot): string {
  if (action.type === "create_task") return `Crear tarea “${action.title}”`;
  if (action.type === "update_task") {
    const task = snapshot.tasks.find((item) => item.id === action.taskId);
    const differences = Object.entries(action.changes).map(([key, value]) => {
      const oldValue = task?.[key as keyof typeof task];
      return `${key}: ${String(oldValue ?? "—")} → ${String(value ?? "—")}`;
    });
    return `Actualizar “${task?.title ?? action.taskId}” · ${differences.join(" · ")}`;
  }
  if (action.type === "update_project") {
    const project = snapshot.projects.find((item) => item.id === action.projectId);
    const differences = Object.entries(action.changes).map(([key, value]) => `${key}: ${String(project?.[key as keyof typeof project] ?? "—")} → ${String(value)}`);
    return `Actualizar “${project?.name ?? "proyecto"}” · ${differences.join(" · ")}`;
  }
  if (action.type === "create_workflow_connection") {
    const label = (reference: string) => snapshot.tasks.find((task) => task.id === reference)?.title ?? reference;
    return `Crear conexión Nodix “${label(action.sourceRef)}” → “${label(action.targetRef)}”`;
  }
  return "Eliminar una conexión Nodix";
}

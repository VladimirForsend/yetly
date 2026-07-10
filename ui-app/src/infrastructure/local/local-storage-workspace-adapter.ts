import type {
  ChatConversation,
  ChatMessage,
  CreateProjectInput,
  CreateTaskInput,
  CreateTeamInput,
  CreateTimeEntryInput,
  CreateWorkspaceInput,
  ImportResult,
  JoinOrganizationInput,
  OrganizationSummary,
  PersonSummary,
  ProjectHealth,
  ProjectSummary,
  TaskStatus,
  TaskSummary,
  TeamMessage,
  TeamSummary,
  TimeEntrySummary,
  UpdateProjectInput,
  UpdateTaskInput,
  WorkflowConnection,
  WorkflowNodePosition,
  WorkspacePort,
  WorkspaceSnapshot,
} from "../../application/ports/workspace-port";
import { cacheTaskFile, getCachedTaskFile, removeCachedTaskFile } from "./task-file-cache";

const STORAGE_KEY = "yetly:v1:workspace";
const SCHEMA_VERSION = 1;

interface PersistedTeam {
  id: string;
  organizationId: string;
  name: string;
  createdAt: string;
}

interface PersistedProject {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  status: ProjectSummary["status"];
  targetDate: string;
  teamName: string;
  accent: string;
  createdAt: string;
}

interface PersistedTask extends Omit<TaskSummary, "projectCode" | "assignees" | "actualMinutes"> {
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

interface PersistedActivity {
  id: string;
  organizationId: string;
  action: string;
  objectLabel: string;
  occurredAt: string;
}

interface PersistedTimer {
  id: string;
  organizationId: string;
  taskId: string;
  startedAtIso: string;
}

interface PersistedWorkspace {
  schemaVersion: number;
  updatedAt: string;
  activeOrganizationId: string;
  organizations: OrganizationSummary[];
  currentUser: PersonSummary;
  teams: PersistedTeam[];
  projects: PersistedProject[];
  tasks: PersistedTask[];
  timeEntries: Array<TimeEntrySummary & { organizationId: string }>;
  activities: PersistedActivity[];
  notifications: WorkspaceSnapshot["notifications"];
  teamMessages: TeamMessage[];
  chatConversations: ChatConversation[];
  chatMessages: ChatMessage[];
  workflowNodePositions: WorkflowNodePosition[];
  workflowConnections: WorkflowConnection[];
  activeTimer?: PersistedTimer;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function nowIso() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function generalChatId(organizationId: string) {
  return `general-${organizationId}`;
}

function initials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "Y";
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function elapsedLabel(startedAtIso: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(startedAtIso).getTime()) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((part) => String(part).padStart(2, "0")).join(":");
}

function relativeLabel(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Ahora";
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days} d`;
}

function ensureGeneralChat(state: PersistedWorkspace) {
  for (const org of state.organizations) {
    if (!state.chatConversations.some((conversation) => conversation.id === generalChatId(org.id))) {
      state.chatConversations.unshift({
        id: generalChatId(org.id),
        type: "general",
        name: "general",
        participants: [clone(state.currentUser)],
        createdBy: state.currentUser.id,
        createdAt: nowIso(),
      });
    }
  }
  if (state.teamMessages.length && !state.chatMessages.length) {
    const conversationId = generalChatId(state.activeOrganizationId);
    state.chatMessages = state.teamMessages.map((message) => ({
      id: message.id,
      conversationId,
      body: message.body,
      author: clone(message.author),
      createdAt: message.createdAt,
    }));
  }
}

function mondayOfCurrentWeek() {
  const date = new Date();
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date;
}

function normalizeCode(input: string) {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

function projectCode(name: string, index: number) {
  const base = normalizeCode(
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .map((part) => part[0])
      .join(""),
  ) || "PRJ";
  return `${base}-${String(index + 1).padStart(2, "0")}`;
}

function assertText(value: string, label: string, min = 2) {
  if (value.trim().length < min) throw new Error(`${label} debe tener al menos ${min} caracteres.`);
}

function safeParse(raw: string): PersistedWorkspace {
  const parsed = JSON.parse(raw) as Partial<PersistedWorkspace>;
  const isString = (value: unknown): value is string => typeof value === "string" && value.length > 0;
  const organizationsValid = Array.isArray(parsed.organizations) && parsed.organizations.every((org) =>
    isString(org?.id) && isString(org?.name) && isString(org?.initials) && isString(org?.color),
  );
  const userValid = Boolean(parsed.currentUser &&
    isString(parsed.currentUser.id) &&
    isString(parsed.currentUser.name) &&
    isString(parsed.currentUser.initials) &&
    isString(parsed.currentUser.role));
  const projectsValid = Array.isArray(parsed.projects) && parsed.projects.every((project) =>
    isString(project?.id) &&
    isString(project?.organizationId) &&
    isString(project?.code) &&
    isString(project?.name) &&
    isString(project?.status) &&
    isString(project?.teamName));
  const tasksValid = Array.isArray(parsed.tasks) && parsed.tasks.every((task) =>
    isString(task?.id) &&
    isString(task?.organizationId) &&
    isString(task?.projectId) &&
    isString(task?.title) &&
    isString(task?.status) &&
    isString(task?.priority) &&
    typeof task?.estimateMinutes === "number" &&
    Array.isArray(task?.labels) &&
    typeof task?.completed === "boolean");
  const entriesValid = Array.isArray(parsed.timeEntries) && parsed.timeEntries.every((entry) =>
    isString(entry?.id) &&
    isString(entry?.organizationId) &&
    isString(entry?.projectId) &&
    isString(entry?.workDate) &&
    typeof entry?.durationMinutes === "number" &&
    entry.durationMinutes > 0);
  const activitiesValid = parsed.activities === undefined || (Array.isArray(parsed.activities) && parsed.activities.every((item) =>
    isString(item?.id) && isString(item?.organizationId) && isString(item?.action) && isString(item?.objectLabel) && isString(item?.occurredAt)));
  const notificationsValid = parsed.notifications === undefined || Array.isArray(parsed.notifications);

  if (
    parsed.schemaVersion !== SCHEMA_VERSION ||
    !isString(parsed.activeOrganizationId) ||
    !organizationsValid ||
    !userValid ||
    !projectsValid ||
    !tasksValid ||
    !entriesValid ||
    !activitiesValid ||
    !notificationsValid
  ) {
    throw new Error("El respaldo no corresponde a un workspace Yetly válido.");
  }

  if (!Array.isArray(parsed.teams)) parsed.teams = [];
  if (!Array.isArray(parsed.activities)) parsed.activities = [];
  if (!Array.isArray(parsed.notifications)) parsed.notifications = [];
  if (!Array.isArray(parsed.teamMessages)) parsed.teamMessages = [];
  if (!Array.isArray(parsed.chatConversations)) parsed.chatConversations = [];
  if (!Array.isArray(parsed.chatMessages)) parsed.chatMessages = [];
  if (!Array.isArray(parsed.workflowNodePositions)) parsed.workflowNodePositions = [];
  if (!Array.isArray(parsed.workflowConnections)) parsed.workflowConnections = [];
  parsed.tasks = parsed.tasks!.map((task) => ({
    ...task,
    mode: task.mode ?? "standard",
    createdBy: task.createdBy ?? parsed.currentUser!.id,
    canEdit: true,
    checklist: Array.isArray(task.checklist) ? task.checklist : [],
    messages: Array.isArray(task.messages) ? task.messages : [],
    attachments: Array.isArray(task.attachments) ? task.attachments : [],
    history: Array.isArray(task.history) ? task.history : [],
  }));

  const orgIds = new Set(parsed.organizations!.map((org) => org.id));
  if (!orgIds.has(parsed.activeOrganizationId!)) throw new Error("El respaldo referencia una organización activa inexistente.");
  if (parsed.projects!.some((project) => !orgIds.has(project.organizationId))) throw new Error("El respaldo contiene proyectos fuera de una organización válida.");

  const projectIds = new Set(parsed.projects!.map((project) => project.id));
  if (parsed.tasks!.some((task) => !projectIds.has(task.projectId))) throw new Error("El respaldo contiene tareas asociadas a proyectos inexistentes.");
  if (parsed.timeEntries!.some((entry) => !projectIds.has(entry.projectId))) throw new Error("El respaldo contiene tiempo asociado a proyectos inexistentes.");

  ensureGeneralChat(parsed as PersistedWorkspace);
  return parsed as PersistedWorkspace;
}

function load(): PersistedWorkspace | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return safeParse(raw);
  } catch {
    throw new Error("Los datos locales de Yetly no se pudieron leer. Exporta el almacenamiento antes de reiniciar.");
  }
}

function save(state: PersistedWorkspace) {
  syncNotifications(state);
  const next = { ...state, updatedAt: nowIso() };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function activeOrg(state: PersistedWorkspace) {
  return state.organizations.find((org) => org.id === state.activeOrganizationId) ?? state.organizations[0];
}

function healthFor(project: PersistedProject, tasks: PersistedTask[]): { health: ProjectHealth; reason: string } {
  const projectTasks = tasks.filter((task) => task.projectId === project.id);
  if (project.status === "completed") return { health: "green", reason: "Proyecto completado." };
  if (!projectTasks.length) return { health: "unknown", reason: "Aún no hay tareas para evaluar la salud." };
  const now = todayIsoDate();
  const overdue = projectTasks.filter((task) => !task.completed && task.dueDate && task.dueDate < now).length;
  const urgent = projectTasks.filter((task) => !task.completed && task.priority === "urgent").length;
  if (overdue > 0) return { health: "red", reason: `${overdue} tarea${overdue === 1 ? "" : "s"} vencida${overdue === 1 ? "" : "s"}.` };
  if (urgent > 0) return { health: "yellow", reason: `${urgent} tarea${urgent === 1 ? "" : "s"} urgente${urgent === 1 ? "" : "s"} abierta${urgent === 1 ? "" : "s"}.` };
  return { health: "green", reason: "Sin vencimientos ni urgencias abiertas." };
}

function deriveSnapshot(state: PersistedWorkspace): WorkspaceSnapshot {
  ensureGeneralChat(state);
  const org = activeOrg(state);
  const orgTeams = state.teams.filter((team) => team.organizationId === org.id);
  const orgProjects = state.projects.filter((project) => project.organizationId === org.id);
  const orgTasks = state.tasks.filter((task) => task.organizationId === org.id);
  const orgEntries = state.timeEntries.filter((entry) => entry.organizationId === org.id);
  const chatConversations = state.chatConversations.filter((conversation) =>
    conversation.id === generalChatId(org.id) ||
    conversation.participants.some((participant) => participant.id === state.currentUser.id),
  );
  const chatConversationIds = new Set(chatConversations.map((conversation) => conversation.id));
  const chatMessages = state.chatMessages.filter((message) => chatConversationIds.has(message.conversationId)).slice(-300);
  const generalMessages = chatMessages.filter((message) => message.conversationId === generalChatId(org.id));

  const projects: ProjectSummary[] = orgProjects.map((project) => {
    const tasks = orgTasks.filter((task) => task.projectId === project.id);
    const done = tasks.filter((task) => task.completed).length;
    const health = healthFor(project, tasks);
    const actualMinutes = orgEntries
      .filter((entry) => entry.projectId === project.id)
      .reduce((sum, entry) => sum + entry.durationMinutes, 0);
    return {
      id: project.id,
      code: project.code,
      name: project.name,
      owner: state.currentUser,
      status: project.status,
      health: health.health,
      healthReason: health.reason,
      progress: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
      targetDate: project.targetDate || "Sin fecha objetivo",
      actualMinutes,
      estimateMinutes: tasks.reduce((sum, task) => sum + task.estimateMinutes, 0),
      teamName: project.teamName,
      accent: project.accent,
    };
  });

  const projectById = new Map(projects.map((project) => [project.id, project]));
  const actualByTask = new Map<string, number>();
  for (const entry of orgEntries) {
    if (!entry.taskId) continue;
    actualByTask.set(entry.taskId, (actualByTask.get(entry.taskId) ?? 0) + entry.durationMinutes);
  }

  const tasks: TaskSummary[] = orgTasks.map((task) => ({
    id: task.id,
    projectId: task.projectId,
    projectCode: projectById.get(task.projectId)?.code ?? "PRJ",
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    startDate: task.startDate,
    estimateMinutes: task.estimateMinutes,
    actualMinutes: actualByTask.get(task.id) ?? 0,
    assignees: [state.currentUser],
    labels: task.labels,
    blockedReason: task.blockedReason,
    completed: task.completed,
    mode: task.mode,
    createdBy: task.createdBy,
    canEdit: true,
    checklist: clone(task.checklist),
    messages: clone(task.messages),
    attachments: clone(task.attachments),
    history: clone(task.history),
  }));

  const assignedMinutes = tasks
    .filter((task) => !task.completed)
    .reduce((sum, task) => sum + task.estimateMinutes, 0);

  const weekStart = mondayOfCurrentWeek();
  const days = ["Lun", "Mar", "Mié", "Jue", "Vie"];
  const weeklyTime = days.map((day, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    const key = date.toISOString().slice(0, 10);
    return {
      day,
      minutes: orgEntries.filter((entry) => entry.workDate === key).reduce((sum, entry) => sum + entry.durationMinutes, 0),
    };
  });

  const timerTask = state.activeTimer ? tasks.find((task) => task.id === state.activeTimer?.taskId) : undefined;

  return {
    activeOrganization: org,
    organizations: clone(state.organizations),
    currentUser: clone(state.currentUser),
    projects,
    tasks,
    teams: orgTeams.map((team): TeamSummary => ({
      id: team.id,
      name: team.name,
      members: [clone(state.currentUser)],
    })),
    workload: [{
      person: clone(state.currentUser),
      capacityMinutes: 2400,
      assignedMinutes,
      taskCount: tasks.filter((task) => !task.completed).length,
      teamName: projects[0]?.teamName ?? "General",
    }],
    activities: state.activities
      .filter((activity) => activity.organizationId === org.id)
      .slice(0, 20)
      .map((activity) => ({
        id: activity.id,
        actor: clone(state.currentUser),
        action: activity.action,
        objectLabel: activity.objectLabel,
        timestampLabel: relativeLabel(activity.occurredAt),
      })),
    notifications: clone(state.notifications),
    weeklyTime,
    timeEntries: orgEntries.map(({ organizationId: _organizationId, ...entry }) => clone(entry)),
    teamMessages: clone(generalMessages),
    chatConversations: clone(chatConversations),
    chatMessages: clone(chatMessages),
    workflowNodePositions: clone(state.workflowNodePositions.filter((position) =>
      orgProjects.some((project) => project.id === position.projectId),
    )),
    workflowConnections: clone(state.workflowConnections.filter((connection) =>
      orgProjects.some((project) => project.id === connection.projectId),
    )),
    activeTimer: state.activeTimer && timerTask ? {
      taskId: timerTask.id,
      taskTitle: timerTask.title,
      startedAtIso: state.activeTimer.startedAtIso,
      elapsedLabel: elapsedLabel(state.activeTimer.startedAtIso),
    } : undefined,
  };
}

function syncNotifications(state: PersistedWorkspace) {
  const today = todayIsoDate();
  const existing = new Map(state.notifications.map((notification) => [notification.id, notification]));
  const signals: WorkspaceSnapshot["notifications"] = [];

  for (const task of state.tasks.filter((item) => item.organizationId === state.activeOrganizationId && !item.completed)) {
    if (task.dueDate && task.dueDate < today) {
      const key = `overdue-${task.id}`;
      signals.push({
        id: key,
        title: "Tarea vencida",
        description: `${task.title} venció el ${task.dueDate}.`,
        unread: existing.get(key)?.unread ?? true,
        tone: "danger",
      });
    } else if (task.priority === "urgent") {
      const key = `urgent-${task.id}`;
      signals.push({
        id: key,
        title: "Tarea urgente abierta",
        description: task.title,
        unread: existing.get(key)?.unread ?? true,
        tone: "warning",
      });
    }
  }

  state.notifications = signals.slice(0, 50);
}

function activity(state: PersistedWorkspace, action: string, objectLabel: string) {
  state.activities.unshift({
    id: id("act"),
    organizationId: state.activeOrganizationId,
    action,
    objectLabel,
    occurredAt: nowIso(),
  });
  state.activities = state.activities.slice(0, 100);
}

function requireState() {
  const state = load();
  if (!state) throw new Error("Completa el onboarding antes de usar el workspace.");
  return state;
}

const accents = ["#6d5dfc", "#2563eb", "#0f766e", "#b45309", "#be123c", "#7c3aed"];

export class LocalStorageWorkspaceAdapter implements WorkspacePort {
  async getSnapshot(organizationId?: string): Promise<WorkspaceSnapshot | null> {
    const state = load();
    if (!state) return null;
    if (organizationId && state.organizations.some((org) => org.id === organizationId)) {
      state.activeOrganizationId = organizationId;
      save(state);
    }
    return deriveSnapshot(state);
  }

  async createWorkspace(input: CreateWorkspaceInput): Promise<WorkspaceSnapshot> {
    assertText(input.userName, "Tu nombre");
    assertText(input.organizationName, "El nombre de la organización");
    const organizationId = id("org");
    const org: OrganizationSummary = {
      id: organizationId,
      name: input.organizationName.trim(),
      initials: initials(input.organizationName),
      color: "#6d5dfc",
    };
    const user: PersonSummary = {
      id: id("usr"),
      name: input.userName.trim(),
      initials: initials(input.userName),
      role: input.role?.trim() || "Owner",
      avatarTone: "bg-brand-100 text-brand-700",
    };
    const state: PersistedWorkspace = {
      schemaVersion: SCHEMA_VERSION,
      updatedAt: nowIso(),
      activeOrganizationId: organizationId,
      organizations: [org],
      currentUser: user,
      teams: [],
      projects: [],
      tasks: [],
      timeEntries: [],
      activities: [],
      notifications: [],
      teamMessages: [],
      chatConversations: [{
        id: generalChatId(organizationId),
        type: "general",
        name: "general",
        participants: [clone(user)],
        createdBy: user.id,
        createdAt: nowIso(),
      }],
      chatMessages: [],
      workflowNodePositions: [],
      workflowConnections: [],
    };
    activity(state, "creó la organización", org.name);
    save(state);
    return deriveSnapshot(state);
  }

  async createOrganization(nameInput: string): Promise<OrganizationSummary> {
    assertText(nameInput, "El nombre de la organización");
    const state = requireState();
    const name = nameInput.trim();
    if (state.organizations.some((org) => org.name.toLowerCase() === name.toLowerCase())) {
      throw new Error("Ya existe una organización con ese nombre.");
    }
    const org: OrganizationSummary = {
      id: id("org"),
      name,
      initials: initials(name),
      color: accents[state.organizations.length % accents.length],
    };
    state.organizations.push(org);
    state.activeOrganizationId = org.id;
    ensureGeneralChat(state);
    activity(state, "creó la organización", org.name);
    save(state);
    return clone(org);
  }

  async joinOrganization(_input: JoinOrganizationInput): Promise<OrganizationSummary> {
    throw new Error("Unirse por código está disponible al conectar Supabase. El modo local no requiere cuenta.");
  }

  async rotateInviteCode(): Promise<string> {
    throw new Error("Los códigos de invitación están disponibles en modo Supabase.");
  }

  async createProject(input: CreateProjectInput): Promise<ProjectSummary> {
    assertText(input.name, "El nombre del proyecto");
    const state = requireState();
    const org = activeOrg(state);
    const existingCodes = new Set(state.projects.map((project) => project.code));
    let code = normalizeCode(input.code ?? "") || projectCode(input.name, state.projects.length);
    if (existingCodes.has(code)) code = `${code}-${state.projects.length + 1}`;
    const teamName = input.teamName?.trim() || "General";
    if (!state.teams.some((team) => team.organizationId === org.id && team.name.toLowerCase() === teamName.toLowerCase())) {
      state.teams.push({ id: id("team"), organizationId: org.id, name: teamName, createdAt: nowIso() });
    }
    const project: PersistedProject = {
      id: id("prj"),
      organizationId: org.id,
      code,
      name: input.name.trim(),
      status: input.status ?? "active",
      targetDate: input.targetDate ?? "",
      teamName,
      accent: accents[state.projects.length % accents.length],
      createdAt: nowIso(),
    };
    state.projects.unshift(project);
    activity(state, "creó el proyecto", project.name);
    save(state);
    return deriveSnapshot(state).projects.find((item) => item.id === project.id)!;
  }

  async updateProject(projectId: string, input: UpdateProjectInput): Promise<ProjectSummary> {
    const state = requireState();
    const project = state.projects.find((item) => item.id === projectId && item.organizationId === state.activeOrganizationId);
    if (!project) throw new Error("No se encontró el proyecto.");
    if (input.name !== undefined) {
      assertText(input.name, "El nombre del proyecto");
      project.name = input.name.trim();
    }
    if (input.teamName !== undefined) project.teamName = input.teamName.trim() || "General";
    if (input.targetDate !== undefined) project.targetDate = input.targetDate;
    if (input.status !== undefined) project.status = input.status;
    activity(state, "actualizó el proyecto", project.name);
    save(state);
    return deriveSnapshot(state).projects.find((item) => item.id === project.id)!;
  }

  async deleteProject(projectId: string): Promise<void> {
    const state = requireState();
    const project = state.projects.find((item) => item.id === projectId && item.organizationId === state.activeOrganizationId);
    if (!project) throw new Error("No se encontró el proyecto.");
    const taskIds = new Set(state.tasks.filter((task) => task.projectId === projectId).map((task) => task.id));
    state.projects = state.projects.filter((item) => item.id !== projectId);
    state.tasks = state.tasks.filter((task) => task.projectId !== projectId);
    state.workflowNodePositions = state.workflowNodePositions.filter((position) => position.projectId !== projectId);
    state.workflowConnections = state.workflowConnections.filter((connection) => connection.projectId !== projectId);
    state.timeEntries = state.timeEntries.filter((entry) => entry.projectId !== projectId && (!entry.taskId || !taskIds.has(entry.taskId)));
    if (state.activeTimer && taskIds.has(state.activeTimer.taskId)) state.activeTimer = undefined;
    activity(state, "eliminó el proyecto", project.name);
    save(state);
  }

  async createTeam(input: CreateTeamInput): Promise<TeamSummary> {
    assertText(input.name, "El nombre del equipo");
    const state = requireState();
    const name = input.name.trim();
    const exists = state.teams.some((team) => team.organizationId === state.activeOrganizationId && team.name.toLowerCase() === name.toLowerCase());
    if (exists) throw new Error("Ya existe un equipo con ese nombre.");
    const team: PersistedTeam = {
      id: id("team"),
      organizationId: state.activeOrganizationId,
      name,
      createdAt: nowIso(),
    };
    state.teams.unshift(team);
    activity(state, "creó el equipo", team.name);
    save(state);
    return { id: team.id, name: team.name, members: [clone(state.currentUser)] };
  }

  async deleteTeam(teamId: string): Promise<void> {
    const state = requireState();
    const team = state.teams.find((item) => item.id === teamId && item.organizationId === state.activeOrganizationId);
    if (!team) throw new Error("No se encontró el equipo.");
    if (state.projects.some((project) => project.organizationId === state.activeOrganizationId && project.teamName === team.name)) {
      throw new Error("No puedes eliminar un equipo que todavía tiene proyectos asociados.");
    }
    state.teams = state.teams.filter((item) => item.id !== teamId);
    activity(state, "eliminó el equipo", team.name);
    save(state);
  }

  async addTeamMember(_teamId: string, _userId: string): Promise<void> {
    throw new Error("El modo local es de una sola persona. Conecta Supabase para miembros compartidos.");
  }

  async removeTeamMember(_teamId: string, _userId: string): Promise<void> {
    throw new Error("El modo local es de una sola persona. Conecta Supabase para miembros compartidos.");
  }

  async createTask(input: CreateTaskInput): Promise<TaskSummary> {
    assertText(input.title, "El título");
    const state = requireState();
    const project = state.projects.find((item) => item.id === input.projectId && item.organizationId === state.activeOrganizationId);
    if (!project) throw new Error("Selecciona un proyecto válido.");
    if (input.startDate && input.dueDate && input.dueDate < input.startDate) throw new Error("La fecha límite no puede ser anterior al inicio.");
    const task: PersistedTask = {
      id: id("tsk"),
      organizationId: state.activeOrganizationId,
      projectId: project.id,
      title: input.title.trim(),
      description: input.description?.trim(),
      status: input.status,
      priority: input.priority,
      dueDate: input.dueDate || undefined,
      startDate: input.startDate || undefined,
      estimateMinutes: Math.max(0, Number(input.estimateMinutes ?? 0)),
      labels: [],
      completed: input.status === "done",
      mode: input.mode ?? "standard",
      createdBy: state.currentUser.id,
      canEdit: true,
      checklist: [],
      messages: [],
      attachments: [],
      history: [{ id: id("evt"), action: "Creó la tarea", detail: input.title.trim(), actor: clone(state.currentUser), createdAt: nowIso() }],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    state.tasks.unshift(task);
    activity(state, "creó la tarea", task.title);
    save(state);
    return deriveSnapshot(state).tasks.find((item) => item.id === task.id)!;
  }

  async updateTask(taskId: string, input: UpdateTaskInput): Promise<TaskSummary> {
    const state = requireState();
    const task = state.tasks.find((item) => item.id === taskId && item.organizationId === state.activeOrganizationId);
    if (!task) throw new Error("No se encontró la tarea.");
    if (input.title !== undefined) {
      assertText(input.title, "El título");
      task.title = input.title.trim();
    }
    if (input.description !== undefined) task.description = input.description.trim();
    if (input.status !== undefined) {
      task.status = input.status;
      task.completed = input.status === "done";
    }
    if (input.priority !== undefined) task.priority = input.priority;
    if (input.dueDate !== undefined) task.dueDate = input.dueDate || undefined;
    if (input.startDate !== undefined) task.startDate = input.startDate || undefined;
    if (input.estimateMinutes !== undefined) task.estimateMinutes = Math.max(0, Number(input.estimateMinutes));
    if (input.mode !== undefined) task.mode = input.mode;
    if (task.startDate && task.dueDate && task.dueDate < task.startDate) throw new Error("La fecha límite no puede ser anterior al inicio.");
    task.updatedAt = nowIso();
    task.history.unshift({ id: id("evt"), action: "Actualizó la tarea", detail: "Cambió sus campos o modo", actor: clone(state.currentUser), createdAt: nowIso() });
    activity(state, "actualizó la tarea", task.title);
    save(state);
    return deriveSnapshot(state).tasks.find((item) => item.id === task.id)!;
  }

  async moveTask(taskId: string, status: TaskStatus): Promise<TaskSummary> {
    return this.updateTask(taskId, { status });
  }

  async deleteTask(taskId: string): Promise<void> {
    const state = requireState();
    const task = state.tasks.find((item) => item.id === taskId && item.organizationId === state.activeOrganizationId);
    if (!task) throw new Error("No se encontró la tarea.");
    state.tasks = state.tasks.filter((item) => item.id !== taskId);
    state.workflowNodePositions = state.workflowNodePositions.filter((position) => position.taskId !== taskId);
    state.workflowConnections = state.workflowConnections.filter((connection) =>
      connection.sourceTaskId !== taskId && connection.targetTaskId !== taskId,
    );
    state.timeEntries = state.timeEntries.filter((entry) => entry.taskId !== taskId);
    if (state.activeTimer?.taskId === taskId) state.activeTimer = undefined;
    activity(state, "eliminó la tarea", task.title);
    save(state);
  }

  async addTaskMessage(taskId: string, body: string): Promise<void> {
    assertText(body, "El mensaje", 1);
    const state = requireState();
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) throw new Error("No se encontró la tarea.");
    task.messages.push({ id: id("msg"), body: body.trim(), author: clone(state.currentUser), createdAt: nowIso() });
    task.history.unshift({ id: id("evt"), action: "Añadió un mensaje", detail: body.trim().slice(0, 120), actor: clone(state.currentUser), createdAt: nowIso() });
    save(state);
  }

  async addChecklistItem(taskId: string, text: string): Promise<void> {
    assertText(text, "El elemento", 1);
    const state = requireState();
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) throw new Error("No se encontró la tarea.");
    task.checklist.push({ id: id("chk"), text: text.trim(), completed: false, createdBy: state.currentUser.id, createdAt: nowIso() });
    task.history.unshift({ id: id("evt"), action: "Añadió un elemento", detail: text.trim(), actor: clone(state.currentUser), createdAt: nowIso() });
    save(state);
  }

  async setChecklistItemCompleted(itemId: string, completed: boolean): Promise<void> {
    const state = requireState();
    const task = state.tasks.find((candidate) => candidate.checklist.some((item) => item.id === itemId));
    const item = task?.checklist.find((candidate) => candidate.id === itemId);
    if (!task || !item) throw new Error("No se encontró el elemento.");
    item.completed = completed;
    task.history.unshift({ id: id("evt"), action: completed ? "Completó un elemento" : "Reabrió un elemento", detail: item.text, actor: clone(state.currentUser), createdAt: nowIso() });
    save(state);
  }

  async deleteChecklistItem(itemId: string): Promise<void> {
    const state = requireState();
    const task = state.tasks.find((candidate) => candidate.checklist.some((item) => item.id === itemId));
    const item = task?.checklist.find((candidate) => candidate.id === itemId);
    if (!task || !item) throw new Error("No se encontró el elemento.");
    task.checklist = task.checklist.filter((candidate) => candidate.id !== itemId);
    task.history.unshift({ id: id("evt"), action: "Eliminó un elemento", detail: item.text, actor: clone(state.currentUser), createdAt: nowIso() });
    save(state);
  }

  async uploadTaskAttachment(taskId: string, file: File): Promise<void> {
    if (!file.size || file.size > 50 * 1024 * 1024) throw new Error("El archivo debe pesar entre 1 byte y 50 MB.");
    const state = requireState();
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) throw new Error("No se encontró la tarea.");
    const attachmentId = id("att");
    await cacheTaskFile(attachmentId, file);
    task.attachments.push({ id: attachmentId, fileName: file.name, contentType: file.type || "application/octet-stream", sizeBytes: file.size, version: 1, uploadedBy: clone(state.currentUser), uploadedAt: nowIso(), cachedLocally: true });
    task.history.unshift({ id: id("evt"), action: "Añadió un adjunto", detail: file.name, actor: clone(state.currentUser), createdAt: nowIso() });
    save(state);
  }

  async replaceTaskAttachment(attachmentId: string, file: File): Promise<void> {
    const state = requireState();
    const task = state.tasks.find((candidate) => candidate.attachments.some((item) => item.id === attachmentId));
    const attachment = task?.attachments.find((item) => item.id === attachmentId);
    if (!task || !attachment || attachment.deletedAt) throw new Error("El adjunto ya no está disponible.");
    const oldName = attachment.fileName;
    await cacheTaskFile(attachmentId, file);
    Object.assign(attachment, { fileName: file.name, contentType: file.type || "application/octet-stream", sizeBytes: file.size, version: attachment.version + 1, cachedLocally: true });
    task.history.unshift({ id: id("evt"), action: "Actualizó un adjunto", detail: `${oldName} → ${file.name}`, actor: clone(state.currentUser), createdAt: nowIso() });
    save(state);
  }

  async downloadTaskAttachment(attachmentId: string): Promise<{ blob: Blob; fileName: string }> {
    const state = requireState();
    const attachment = state.tasks.flatMap((task) => task.attachments).find((item) => item.id === attachmentId);
    if (!attachment || attachment.deletedAt) throw new Error("El adjunto fue eliminado.");
    const blob = await getCachedTaskFile(attachmentId);
    if (!blob) throw new Error("Este archivo no está disponible en este navegador.");
    return { blob, fileName: attachment.fileName };
  }

  async deleteTaskAttachment(attachmentId: string): Promise<void> {
    const state = requireState();
    const task = state.tasks.find((candidate) => candidate.attachments.some((item) => item.id === attachmentId));
    const attachment = task?.attachments.find((item) => item.id === attachmentId);
    if (!task || !attachment) throw new Error("No se encontró el adjunto.");
    attachment.deletedAt = nowIso();
    attachment.cachedLocally = false;
    await removeCachedTaskFile(attachmentId);
    task.history.unshift({ id: id("evt"), action: "Eliminó un adjunto", detail: attachment.fileName, actor: clone(state.currentUser), createdAt: nowIso() });
    save(state);
  }

  async sendTeamMessage(body: string): Promise<void> {
    const state = requireState();
    await this.sendChatMessage(generalChatId(state.activeOrganizationId), body);
  }

  async createChatChannel(nameInput: string): Promise<void> {
    assertText(nameInput, "El nombre del canal");
    const state = requireState();
    const name = nameInput.trim().replace(/^#/, "");
    if (state.chatConversations.some((conversation) => conversation.type !== "direct" && conversation.name.toLowerCase() === name.toLowerCase())) {
      throw new Error("Ya existe un canal con ese nombre.");
    }
    state.chatConversations.push({
      id: id("chn"),
      type: "channel",
      name,
      participants: [clone(state.currentUser)],
      createdBy: state.currentUser.id,
      createdAt: nowIso(),
    });
    save(state);
  }

  async startDirectChat(userId: string): Promise<string> {
    const state = requireState();
    if (userId === state.currentUser.id) throw new Error("No puedes abrir un chat directo contigo mismo.");
    const person = deriveSnapshot(state).workload.find((item) => item.person.id === userId)?.person;
    if (!person) throw new Error("No encontramos esa persona en tu organización.");
    const existing = state.chatConversations.find((conversation) =>
      conversation.type === "direct" &&
      conversation.participants.some((participant) => participant.id === state.currentUser.id) &&
      conversation.participants.some((participant) => participant.id === userId),
    );
    if (existing) return existing.id;
    const conversation = {
      id: id("dm"),
      type: "direct" as const,
      name: person.name,
      participants: [clone(state.currentUser), clone(person)],
      createdBy: state.currentUser.id,
      createdAt: nowIso(),
    };
    state.chatConversations.push(conversation);
    save(state);
    return conversation.id;
  }

  async sendChatMessage(conversationId: string, body: string): Promise<void> {
    assertText(body, "El mensaje", 1);
    const state = requireState();
    ensureGeneralChat(state);
    const conversation = state.chatConversations.find((item) => item.id === conversationId);
    if (!conversation) throw new Error("No encontramos esa conversación.");
    state.chatMessages.push({
      id: id("msg"),
      conversationId,
      body: body.trim(),
      author: clone(state.currentUser),
      createdAt: nowIso(),
    });
    state.chatMessages = state.chatMessages.slice(-500);
    state.teamMessages = state.chatMessages
      .filter((message) => message.conversationId === generalChatId(state.activeOrganizationId))
      .map((message) => ({ id: message.id, body: message.body, author: clone(message.author), createdAt: message.createdAt }))
      .slice(-100);
    save(state);
  }

  async saveWorkflowNodePosition(projectId: string, taskId: string, x: number, y: number): Promise<void> {
    const state = requireState();
    const task = state.tasks.find((item) => item.id === taskId && item.projectId === projectId);
    if (!task) throw new Error("No se encontró la tarea del flujo.");
    const position = state.workflowNodePositions.find((item) => item.projectId === projectId && item.taskId === taskId);
    const next = { projectId, taskId, x: Math.round(x), y: Math.round(y), updatedAt: nowIso() };
    if (position) Object.assign(position, next);
    else state.workflowNodePositions.push(next);
    save(state);
  }

  async createWorkflowConnection(projectId: string, sourceTaskId: string, targetTaskId: string): Promise<void> {
    if (sourceTaskId === targetTaskId) throw new Error("Una tarea no puede conectarse consigo misma.");
    const state = requireState();
    const taskIds = new Set(state.tasks.filter((task) => task.projectId === projectId).map((task) => task.id));
    if (!taskIds.has(sourceTaskId) || !taskIds.has(targetTaskId)) throw new Error("Las dos tareas deben pertenecer al proyecto.");
    if (state.workflowConnections.some((item) => item.projectId === projectId && item.sourceTaskId === sourceTaskId && item.targetTaskId === targetTaskId)) {
      throw new Error("Esa conexión ya existe.");
    }
    state.workflowConnections.push({
      id: id("flow"),
      projectId,
      sourceTaskId,
      targetTaskId,
      createdAt: nowIso(),
    });
    save(state);
  }

  async deleteWorkflowConnection(connectionId: string): Promise<void> {
    const state = requireState();
    const exists = state.workflowConnections.some((connection) => connection.id === connectionId);
    if (!exists) throw new Error("No se encontró la conexión.");
    state.workflowConnections = state.workflowConnections.filter((connection) => connection.id !== connectionId);
    save(state);
  }

  async startTimer(taskId: string): Promise<void> {
    const state = requireState();
    const task = state.tasks.find((item) => item.id === taskId && item.organizationId === state.activeOrganizationId);
    if (!task) throw new Error("No se encontró la tarea.");
    if (state.activeTimer) throw new Error("Ya existe un timer activo. Deténlo antes de iniciar otro.");
    state.activeTimer = {
      id: id("tmr"),
      organizationId: state.activeOrganizationId,
      taskId,
      startedAtIso: nowIso(),
    };
    activity(state, "inició el timer en", task.title);
    save(state);
  }

  async stopTimer(): Promise<TimeEntrySummary> {
    const state = requireState();
    const timer = state.activeTimer;
    if (!timer) throw new Error("No hay un timer activo.");
    const task = state.tasks.find((item) => item.id === timer.taskId);
    if (!task) throw new Error("La tarea del timer ya no existe.");
    const minutes = Math.max(1, Math.round((Date.now() - new Date(timer.startedAtIso).getTime()) / 60_000));
    const entry: TimeEntrySummary & { organizationId: string } = {
      id: id("tim"),
      organizationId: state.activeOrganizationId,
      projectId: task.projectId,
      taskId: task.id,
      workDate: todayIsoDate(),
      durationMinutes: minutes,
      note: `Timer: ${task.title}`,
      source: "timer",
    };
    state.timeEntries.unshift(entry);
    state.activeTimer = undefined;
    activity(state, "registró tiempo en", task.title);
    save(state);
    const { organizationId: _organizationId, ...result } = entry;
    return result;
  }

  async createTimeEntry(input: CreateTimeEntryInput): Promise<TimeEntrySummary> {
    const state = requireState();
    const project = state.projects.find((item) => item.id === input.projectId && item.organizationId === state.activeOrganizationId);
    if (!project) throw new Error("Selecciona un proyecto válido.");
    if (!Number.isFinite(input.durationMinutes) || input.durationMinutes <= 0) throw new Error("La duración debe ser mayor que cero.");
    if (input.taskId && !state.tasks.some((task) => task.id === input.taskId && task.projectId === project.id)) {
      throw new Error("La tarea seleccionada no pertenece al proyecto.");
    }
    const entry: TimeEntrySummary & { organizationId: string } = {
      id: id("tim"),
      organizationId: state.activeOrganizationId,
      projectId: project.id,
      taskId: input.taskId || undefined,
      workDate: input.workDate,
      durationMinutes: Math.round(input.durationMinutes),
      note: input.note?.trim() ?? "",
      source: "manual",
    };
    state.timeEntries.unshift(entry);
    activity(state, "registró tiempo en", project.name);
    save(state);
    const { organizationId: _organizationId, ...result } = entry;
    return result;
  }

  async markAllNotificationsRead(): Promise<void> {
    const state = requireState();
    state.notifications = state.notifications.map((notification) => ({ ...notification, unread: false }));
    save(state);
  }

  async exportSnapshot(): Promise<string> {
    const state = requireState();
    return JSON.stringify(state, null, 2);
  }

  async importSnapshot(serialized: string): Promise<ImportResult> {
    let parsed: PersistedWorkspace;
    try {
      parsed = safeParse(serialized);
    } catch (error) {
      throw error instanceof Error ? error : new Error("El respaldo no es válido.");
    }
    save(parsed);
    return {
      projects: parsed.projects.length,
      tasks: parsed.tasks.length,
      timeEntries: parsed.timeEntries.length,
    };
  }

  async resetWorkspace(): Promise<void> {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

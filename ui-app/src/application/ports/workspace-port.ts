export type ProjectHealth = "green" | "yellow" | "red" | "unknown";
export type ProjectStatus = "planned" | "active" | "on_hold" | "completed";
export type TaskStatus = "backlog" | "todo" | "in_progress" | "review" | "done";
export type Priority = "low" | "normal" | "high" | "urgent";
export type TaskMode = "standard" | "checklist" | "message";

export interface OrganizationSummary {
  id: string;
  name: string;
  initials: string;
  color: string;
  inviteCode?: string;
  memberRole?: "owner" | "admin" | "member" | "viewer";
}

export interface PersonSummary {
  id: string;
  name: string;
  initials: string;
  role: string;
  avatarTone: string;
}

export interface ProjectSummary {
  id: string;
  code: string;
  name: string;
  owner: PersonSummary;
  status: ProjectStatus;
  health: ProjectHealth;
  healthReason: string;
  progress: number;
  targetDate: string;
  actualMinutes: number;
  estimateMinutes: number;
  teamName: string;
  accent: string;
}

export interface TaskSummary {
  id: string;
  projectId: string;
  projectCode: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  dueDate?: string;
  startDate?: string;
  estimateMinutes: number;
  actualMinutes: number;
  assignees: PersonSummary[];
  labels: string[];
  blockedReason?: string;
  completed: boolean;
  mode: TaskMode;
  createdBy: string;
  canEdit: boolean;
  checklist: TaskChecklistItem[];
  messages: TaskMessage[];
  attachments: TaskAttachment[];
  history: TaskHistoryItem[];
}

export interface TaskChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  createdBy: string;
  createdAt: string;
}

export interface TaskMessage {
  id: string;
  body: string;
  author: PersonSummary;
  createdAt: string;
}

export interface TaskAttachment {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  version: number;
  uploadedBy: PersonSummary;
  uploadedAt: string;
  deletedAt?: string;
  cachedLocally: boolean;
}

export interface TaskHistoryItem {
  id: string;
  action: string;
  detail: string;
  actor: PersonSummary;
  createdAt: string;
}

export interface TeamMessage {
  id: string;
  body: string;
  author: PersonSummary;
  createdAt: string;
}

export type ChatConversationType = "general" | "channel" | "direct";

export interface ChatConversation {
  id: string;
  type: ChatConversationType;
  name: string;
  participants: PersonSummary[];
  createdBy?: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  body: string;
  author: PersonSummary;
  createdAt: string;
  updatedAt?: string;
}

export interface WorkflowNodePosition {
  projectId: string;
  taskId: string;
  x: number;
  y: number;
  updatedAt: string;
}

export interface WorkflowConnection {
  id: string;
  projectId: string;
  sourceTaskId: string;
  targetTaskId: string;
  createdAt: string;
}

export interface TeamSummary {
  id: string;
  name: string;
  members: PersonSummary[];
}

export interface WorkloadPerson {
  person: PersonSummary;
  capacityMinutes: number;
  assignedMinutes: number;
  taskCount: number;
  teamName: string;
}

export interface ActivityItem {
  id: string;
  actor: PersonSummary;
  action: string;
  objectLabel: string;
  timestampLabel: string;
}

export interface NotificationSummary {
  id: string;
  title: string;
  description: string;
  unread: boolean;
  tone: "info" | "warning" | "danger";
}

export interface WeeklyTimePoint {
  day: string;
  minutes: number;
}

export interface TimeEntrySummary {
  id: string;
  projectId: string;
  taskId?: string;
  workDate: string;
  durationMinutes: number;
  note: string;
  source: "timer" | "manual";
}

export interface WorkspaceSnapshot {
  activeOrganization: OrganizationSummary;
  organizations: OrganizationSummary[];
  currentUser: PersonSummary;
  projects: ProjectSummary[];
  tasks: TaskSummary[];
  teams: TeamSummary[];
  workload: WorkloadPerson[];
  activities: ActivityItem[];
  notifications: NotificationSummary[];
  weeklyTime: WeeklyTimePoint[];
  timeEntries: TimeEntrySummary[];
  teamMessages: TeamMessage[];
  chatConversations: ChatConversation[];
  chatMessages: ChatMessage[];
  workflowNodePositions: WorkflowNodePosition[];
  workflowConnections: WorkflowConnection[];
  activeTimer?: {
    taskId: string;
    taskTitle: string;
    startedAtIso: string;
    elapsedLabel: string;
  };
}

export interface CreateWorkspaceInput {
  userName: string;
  organizationName: string;
  role?: string;
}

export interface JoinOrganizationInput {
  inviteCode: string;
  userName: string;
  role?: string;
}

export interface CreateProjectInput {
  name: string;
  code?: string;
  teamName?: string;
  targetDate?: string;
  status?: ProjectStatus;
}

export interface UpdateProjectInput {
  name?: string;
  teamName?: string;
  targetDate?: string;
  status?: ProjectStatus;
}

export interface CreateTeamInput {
  name: string;
}

export interface CreateTaskInput {
  projectId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  dueDate?: string;
  startDate?: string;
  estimateMinutes?: number;
  assigneeId?: string;
  mode?: TaskMode;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  dueDate?: string;
  startDate?: string;
  estimateMinutes?: number;
  assigneeId?: string;
  mode?: TaskMode;
}

export interface CreateTimeEntryInput {
  projectId: string;
  taskId?: string;
  workDate: string;
  durationMinutes: number;
  note?: string;
}

export interface ImportResult {
  projects: number;
  tasks: number;
  timeEntries: number;
  teams?: number;
  checklistItems?: number;
  messages?: number;
  workflowConnections?: number;
  attachments?: number;
  skipped?: number;
  issues?: Array<{ entityType: string; localId?: string; message: string; recoverable: boolean }>;
}

export interface WorkspacePort {
  getSnapshot(organizationId?: string): Promise<WorkspaceSnapshot | null>;
  createWorkspace(input: CreateWorkspaceInput): Promise<WorkspaceSnapshot>;
  createOrganization(name: string): Promise<OrganizationSummary>;
  joinOrganization(input: JoinOrganizationInput): Promise<OrganizationSummary>;
  rotateInviteCode(): Promise<string>;
  createProject(input: CreateProjectInput): Promise<ProjectSummary>;
  updateProject(projectId: string, input: UpdateProjectInput): Promise<ProjectSummary>;
  deleteProject(projectId: string): Promise<void>;
  createTeam(input: CreateTeamInput): Promise<TeamSummary>;
  deleteTeam(teamId: string): Promise<void>;
  addTeamMember(teamId: string, userId: string): Promise<void>;
  removeTeamMember(teamId: string, userId: string): Promise<void>;
  createTask(input: CreateTaskInput): Promise<TaskSummary>;
  updateTask(taskId: string, input: UpdateTaskInput): Promise<void>;
  moveTask(taskId: string, status: TaskStatus): Promise<void>;
  deleteTask(taskId: string): Promise<void>;
  addTaskMessage(taskId: string, body: string): Promise<void>;
  addChecklistItem(taskId: string, text: string): Promise<void>;
  setChecklistItemCompleted(itemId: string, completed: boolean): Promise<void>;
  deleteChecklistItem(itemId: string): Promise<void>;
  uploadTaskAttachment(taskId: string, file: File): Promise<void>;
  replaceTaskAttachment(attachmentId: string, file: File): Promise<void>;
  downloadTaskAttachment(attachmentId: string): Promise<{ blob: Blob; fileName: string }>;
  deleteTaskAttachment(attachmentId: string): Promise<void>;
  sendTeamMessage(body: string): Promise<void>;
  createChatChannel(name: string): Promise<string>;
  startDirectChat(userId: string): Promise<string>;
  sendChatMessage(conversationId: string, body: string): Promise<void>;
  updateChatMessage(messageId: string, body: string): Promise<void>;
  deleteChatMessage(messageId: string): Promise<void>;
  updateChatChannel(conversationId: string, name: string): Promise<void>;
  deleteChatChannel(conversationId: string): Promise<void>;
  saveWorkflowNodePosition(projectId: string, taskId: string, x: number, y: number): Promise<void>;
  createWorkflowConnection(projectId: string, sourceTaskId: string, targetTaskId: string): Promise<void>;
  deleteWorkflowConnection(connectionId: string): Promise<void>;
  startTimer(taskId: string): Promise<void>;
  stopTimer(): Promise<TimeEntrySummary>;
  createTimeEntry(input: CreateTimeEntryInput): Promise<TimeEntrySummary>;
  markAllNotificationsRead(): Promise<void>;
  exportSnapshot(): Promise<string>;
  importSnapshot(serialized: string): Promise<ImportResult>;
  resetWorkspace(): Promise<void>;
  subscribe?(onChange: () => void): () => void;
}

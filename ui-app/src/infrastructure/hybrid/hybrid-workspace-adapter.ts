import type {
  CreateProjectInput,
  CreateTaskInput,
  CreateTeamInput,
  CreateTimeEntryInput,
  CreateWorkspaceInput,
  ImportResult,
  JoinOrganizationInput,
  OrganizationSummary,
  ProjectSummary,
  TaskStatus,
  TaskSummary,
  TeamSummary,
  TimeEntrySummary,
  UpdateProjectInput,
  UpdateTaskInput,
  WorkspacePort,
  WorkspaceSnapshot,
} from "../../application/ports/workspace-port";
import { LocalStorageWorkspaceAdapter } from "../local/local-storage-workspace-adapter";
import {
  getStorageMode,
  getSupabaseConfig,
  useLocalMode,
} from "../supabase/supabase-connection";
import { SupabaseWorkspaceAdapter } from "../supabase/supabase-workspace-adapter";

const local = new LocalStorageWorkspaceAdapter();

export class HybridWorkspaceAdapter implements WorkspacePort {
  private supabaseSignature = "";
  private supabaseAdapter: SupabaseWorkspaceAdapter | null = null;

  private active(): WorkspacePort {
    if (getStorageMode() !== "supabase") return local;
    const config = getSupabaseConfig();
    if (!config) return local;
    const signature = `${config.url}|${config.publishableKey}`;
    if (!this.supabaseAdapter || this.supabaseSignature !== signature) {
      this.supabaseAdapter = new SupabaseWorkspaceAdapter(config);
      this.supabaseSignature = signature;
    }
    return this.supabaseAdapter;
  }

  private async ensureLocal(snapshot: WorkspaceSnapshot | null): Promise<WorkspaceSnapshot | null> {
    if (snapshot || getStorageMode() === "supabase") return snapshot;
    useLocalMode();
    return local.createWorkspace({
      userName: "Tú",
      organizationName: "Mi espacio",
      role: "Owner",
    });
  }

  async getSnapshot(organizationId?: string) {
    const adapter = this.active();
    const snapshot = await adapter.getSnapshot(organizationId);
    return this.ensureLocal(snapshot);
  }

  createWorkspace(input: CreateWorkspaceInput) { return this.active().createWorkspace(input); }
  createOrganization(name: string) { return this.active().createOrganization(name); }
  joinOrganization(input: JoinOrganizationInput) { return this.active().joinOrganization(input); }
  rotateInviteCode() { return this.active().rotateInviteCode(); }
  createProject(input: CreateProjectInput) { return this.active().createProject(input); }
  updateProject(projectId: string, input: UpdateProjectInput) { return this.active().updateProject(projectId, input); }
  deleteProject(projectId: string) { return this.active().deleteProject(projectId); }
  createTeam(input: CreateTeamInput) { return this.active().createTeam(input); }
  deleteTeam(teamId: string) { return this.active().deleteTeam(teamId); }
  addTeamMember(teamId: string, userId: string) { return this.active().addTeamMember(teamId, userId); }
  removeTeamMember(teamId: string, userId: string) { return this.active().removeTeamMember(teamId, userId); }
  createTask(input: CreateTaskInput) { return this.active().createTask(input); }
  updateTask(taskId: string, input: UpdateTaskInput) { return this.active().updateTask(taskId, input); }
  moveTask(taskId: string, status: TaskStatus) { return this.active().moveTask(taskId, status); }
  deleteTask(taskId: string) { return this.active().deleteTask(taskId); }
  addTaskMessage(taskId: string, body: string) { return this.active().addTaskMessage(taskId, body); }
  addChecklistItem(taskId: string, text: string) { return this.active().addChecklistItem(taskId, text); }
  setChecklistItemCompleted(itemId: string, completed: boolean) { return this.active().setChecklistItemCompleted(itemId, completed); }
  deleteChecklistItem(itemId: string) { return this.active().deleteChecklistItem(itemId); }
  uploadTaskAttachment(taskId: string, file: File) { return this.active().uploadTaskAttachment(taskId, file); }
  replaceTaskAttachment(attachmentId: string, file: File) { return this.active().replaceTaskAttachment(attachmentId, file); }
  downloadTaskAttachment(attachmentId: string) { return this.active().downloadTaskAttachment(attachmentId); }
  deleteTaskAttachment(attachmentId: string) { return this.active().deleteTaskAttachment(attachmentId); }
  sendTeamMessage(body: string) { return this.active().sendTeamMessage(body); }
  createChatChannel(name: string) { return this.active().createChatChannel(name); }
  startDirectChat(userId: string) { return this.active().startDirectChat(userId); }
  sendChatMessage(conversationId: string, body: string) { return this.active().sendChatMessage(conversationId, body); }
  saveWorkflowNodePosition(projectId: string, taskId: string, x: number, y: number) { return this.active().saveWorkflowNodePosition(projectId, taskId, x, y); }
  createWorkflowConnection(projectId: string, sourceTaskId: string, targetTaskId: string) { return this.active().createWorkflowConnection(projectId, sourceTaskId, targetTaskId); }
  deleteWorkflowConnection(connectionId: string) { return this.active().deleteWorkflowConnection(connectionId); }
  startTimer(taskId: string) { return this.active().startTimer(taskId); }
  stopTimer() { return this.active().stopTimer(); }
  createTimeEntry(input: CreateTimeEntryInput) { return this.active().createTimeEntry(input); }
  markAllNotificationsRead() { return this.active().markAllNotificationsRead(); }
  exportSnapshot() { return this.active().exportSnapshot(); }
  importSnapshot(serialized: string): Promise<ImportResult> { return this.active().importSnapshot(serialized); }
  resetWorkspace() { return this.active().resetWorkspace(); }

  subscribe(onChange: () => void) {
    return this.active().subscribe?.(onChange) ?? (() => {});
  }
}

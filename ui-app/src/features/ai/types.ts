import type { ProjectStatus, TaskMode, TaskStatus, Priority, UpdateTaskInput } from "../../application/ports/workspace-port";

export type AiScopeType = "project" | "task";
export type AiProposalStatus = "pending" | "applied" | "discarded" | "partial";

export interface AiScope {
  type: AiScopeType;
  projectId: string;
  taskId?: string;
}

export interface OllamaConfig {
  apiKey: string;
  defaultModel?: string;
  remember: boolean;
}

export interface OllamaModel {
  name: string;
  model: string;
  parameterSize?: string;
  family?: string;
  capabilities: string[];
}

export interface AiUsage {
  totalDuration?: number;
  promptTokens?: number;
  completionTokens?: number;
}

export interface AiConversation {
  id: string;
  organizationId: string;
  userId: string;
  scope: AiScope;
  title: string;
  model: string;
  createdAt: string;
  updatedAt: string;
}

export type AiAction =
  | {
      id: string;
      type: "create_task";
      clientRef: string;
      title: string;
      description?: string;
      status?: TaskStatus;
      priority?: Priority;
      dueDate?: string;
      startDate?: string;
      estimateMinutes?: number;
      assigneeId?: string;
      mode?: TaskMode;
      nearTaskId?: string;
    }
  | { id: string; type: "update_task"; taskId: string; changes: UpdateTaskInput }
  | { id: string; type: "update_project"; projectId: string; changes: { targetDate?: string; status?: ProjectStatus } }
  | { id: string; type: "create_workflow_connection"; projectId: string; sourceRef: string; targetRef: string }
  | { id: string; type: "delete_workflow_connection"; projectId: string; connectionId: string };

export interface AiProposal {
  summary: string;
  actions: AiAction[];
  status: AiProposalStatus;
  results?: Array<{ actionId: string; ok: boolean; message: string }>;
}

export interface AiMessage {
  id: string;
  conversationId: string;
  organizationId: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  usage?: AiUsage;
  proposal?: AiProposal;
  createdAt: string;
}

export interface AiContextMetadata {
  capturedAt: string;
  projectName: string;
  taskName?: string;
  includedTasks: number;
  omittedTasks: number;
  includesMessages: boolean;
  includesAttachmentMetadata: boolean;
  characterCount: number;
}

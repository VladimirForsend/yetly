import { getStorageMode, getSupabaseClient } from "../../../infrastructure/supabase/supabase-connection";
import type { AiConversation, AiMessage, AiProposal, AiProposalStatus, AiScope, AiUsage } from "../types";

const LOCAL_KEY = "yetly:ai-history:v1";

interface LocalHistory {
  conversations: AiConversation[];
  messages: AiMessage[];
}

function empty(): LocalHistory { return { conversations: [], messages: [] }; }
function now() { return new Date().toISOString(); }
function uid() { return crypto.randomUUID(); }

function loadLocal(): LocalHistory {
  try {
    const value = JSON.parse(window.localStorage.getItem(LOCAL_KEY) ?? "null") as Partial<LocalHistory> | null;
    return {
      conversations: Array.isArray(value?.conversations) ? value.conversations : [],
      messages: Array.isArray(value?.messages) ? value.messages : [],
    };
  } catch {
    return empty();
  }
}

function saveLocal(value: LocalHistory) {
  window.localStorage.setItem(LOCAL_KEY, JSON.stringify(value));
}

async function cloudUserId() {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("Inicia sesión para sincronizar el historial privado de IA.");
  return data.user.id;
}

function mapConversation(row: Record<string, any>): AiConversation {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    scope: { type: row.scope_type, projectId: row.project_id, taskId: row.task_id || undefined },
    title: row.title,
    model: row.model,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessage(row: Record<string, any>): AiMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    organizationId: row.organization_id,
    userId: row.user_id,
    role: row.role,
    content: row.content,
    model: row.model || undefined,
    usage: row.usage || undefined,
    proposal: row.proposal || undefined,
    createdAt: row.created_at,
  };
}

export class AiHistoryRepository {
  async listConversations(organizationId: string, userId: string, scope: AiScope): Promise<AiConversation[]> {
    if (getStorageMode() === "local") {
      return loadLocal().conversations
        .filter((conversation) => conversation.organizationId === organizationId && conversation.userId === userId
          && conversation.scope.type === scope.type && conversation.scope.projectId === scope.projectId
          && (scope.type !== "task" || conversation.scope.taskId === scope.taskId))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
    await cloudUserId();
    let query = getSupabaseClient().from("ai_conversations").select("*")
      .eq("organization_id", organizationId).eq("scope_type", scope.type).eq("project_id", scope.projectId)
      .order("updated_at", { ascending: false });
    query = scope.type === "task" ? query.eq("task_id", scope.taskId!) : query.is("task_id", null);
    const { data, error } = await query;
    if (error) throw new Error(`No pudimos cargar tu historial privado de IA: ${error.message}`);
    return (data ?? []).map(mapConversation);
  }

  async createConversation(input: { organizationId: string; userId: string; scope: AiScope; title: string; model: string }): Promise<AiConversation> {
    const createdAt = now();
    if (getStorageMode() === "local") {
      const state = loadLocal();
      const conversation: AiConversation = { id: uid(), ...input, createdAt, updatedAt: createdAt };
      state.conversations.unshift(conversation);
      saveLocal(state);
      return conversation;
    }
    const userId = await cloudUserId();
    const { data, error } = await getSupabaseClient().from("ai_conversations").insert({
      organization_id: input.organizationId,
      user_id: userId,
      scope_type: input.scope.type,
      project_id: input.scope.projectId,
      task_id: input.scope.taskId || null,
      title: input.title,
      model: input.model,
    }).select("*").single();
    if (error) throw new Error(`No pudimos crear la conversación: ${error.message}`);
    return mapConversation(data);
  }

  async listMessages(conversationId: string, userId: string): Promise<AiMessage[]> {
    if (getStorageMode() === "local") {
      return loadLocal().messages.filter((message) => message.conversationId === conversationId && message.userId === userId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }
    await cloudUserId();
    const { data, error } = await getSupabaseClient().from("ai_messages").select("*")
      .eq("conversation_id", conversationId).order("created_at");
    if (error) throw new Error(`No pudimos cargar los mensajes: ${error.message}`);
    return (data ?? []).map(mapMessage);
  }

  async addMessage(input: {
    conversationId: string;
    organizationId: string;
    userId: string;
    role: "user" | "assistant";
    content: string;
    model?: string;
    usage?: AiUsage;
    proposal?: AiProposal;
  }): Promise<AiMessage> {
    const createdAt = now();
    if (getStorageMode() === "local") {
      const state = loadLocal();
      const message: AiMessage = { id: uid(), ...input, createdAt };
      state.messages.push(message);
      const conversation = state.conversations.find((item) => item.id === input.conversationId);
      if (conversation) conversation.updatedAt = createdAt;
      saveLocal(state);
      return message;
    }
    const userId = await cloudUserId();
    const client = getSupabaseClient();
    const { data, error } = await client.from("ai_messages").insert({
      conversation_id: input.conversationId,
      organization_id: input.organizationId,
      user_id: userId,
      role: input.role,
      content: input.content,
      model: input.model || null,
      usage: input.usage || {},
      proposal: input.proposal || null,
    }).select("*").single();
    if (error) throw new Error(`No pudimos guardar el mensaje: ${error.message}`);
    await client.from("ai_conversations").update({ updated_at: createdAt, model: input.model || undefined }).eq("id", input.conversationId);
    return mapMessage(data);
  }

  async updateProposal(messageId: string, userId: string, proposal: AiProposal, status: AiProposalStatus): Promise<void> {
    const next = { ...proposal, status };
    if (getStorageMode() === "local") {
      const state = loadLocal();
      const message = state.messages.find((item) => item.id === messageId && item.userId === userId);
      if (!message) throw new Error("No encontramos la propuesta.");
      message.proposal = next;
      saveLocal(state);
      return;
    }
    await cloudUserId();
    const { error } = await getSupabaseClient().from("ai_messages").update({ proposal: next }).eq("id", messageId);
    if (error) throw new Error(`No pudimos actualizar la propuesta: ${error.message}`);
  }
}

export const aiHistoryRepository = new AiHistoryRepository();

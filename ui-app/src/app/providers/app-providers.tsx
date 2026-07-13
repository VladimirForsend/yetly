import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  CreateProjectInput,
  CreateTaskInput,
  CreateTeamInput,
  CreateTimeEntryInput,
  CreateWorkspaceInput,
  ImportResult,
  JoinOrganizationInput,
  TaskStatus,
  TaskSummary,
  UpdateProjectInput,
  UpdateTaskInput,
  WorkspaceSnapshot,
} from "../../application/ports/workspace-port";
import {
  activatePasswordRecoveryIntent,
  getStorageMode,
  getPublishedSupabaseConfig,
  getSupabaseConfig,
  getSupabaseUser,
  isPasswordRecoveryPending,
  onSupabaseAuthChange,
  probeSupabase,
  saveSupabaseConfig,
  requestPasswordRecovery,
  signInWithGoogle,
  signInWithPassword,
  signOutSupabase,
  signUpWithPassword,
  restoreOAuthReturnPath,
  updateSupabasePassword,
  useLocalMode,
  type StorageMode,
  type SupabaseConnectionConfig,
  type SupabaseProbeResult,
} from "../../infrastructure/supabase/supabase-connection";
import { workspacePort } from "../services/workspace";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

interface WorkspaceContextValue {
  snapshot: WorkspaceSnapshot | null | undefined;
  isLoading: boolean;
  isError: boolean;
  error?: Error;
  needsOnboarding: boolean;
  activeOrganizationId?: string;
  storageMode: StorageMode;
  supabaseConfig: SupabaseConnectionConfig | null;
  cloudUserEmail?: string;
  switchOrganization: (organizationId: string) => void;
  refetch: () => void;
  connectSupabase: (config: SupabaseConnectionConfig) => Promise<SupabaseProbeResult>;
  disconnectSupabase: () => Promise<void>;
  signUpCloud: (email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>;
  signInCloud: (email: string, password: string) => Promise<void>;
  signInGoogleCloud: (returnHash?: string) => Promise<void>;
  requestPasswordRecovery: (email: string) => Promise<void>;
  updateCloudPassword: (password: string) => Promise<void>;
  signOutCloud: () => Promise<void>;
  joinOrganization: (input: JoinOrganizationInput) => Promise<void>;
  rotateInviteCode: () => Promise<string>;
  createWorkspace: (input: CreateWorkspaceInput) => Promise<void>;
  createOrganization: (name: string) => Promise<void>;
  createProject: (input: CreateProjectInput) => Promise<void>;
  createTeam: (input: CreateTeamInput) => Promise<void>;
  deleteTeam: (teamId: string) => Promise<void>;
  addTeamMember: (teamId: string, userId: string) => Promise<void>;
  removeTeamMember: (teamId: string, userId: string) => Promise<void>;
  updateProject: (projectId: string, input: UpdateProjectInput) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  createTask: (input: CreateTaskInput) => Promise<TaskSummary>;
  updateTask: (taskId: string, input: UpdateTaskInput) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  addTaskMessage: (taskId: string, body: string) => Promise<void>;
  addChecklistItem: (taskId: string, text: string) => Promise<void>;
  setChecklistItemCompleted: (itemId: string, completed: boolean) => Promise<void>;
  deleteChecklistItem: (itemId: string) => Promise<void>;
  uploadTaskAttachment: (taskId: string, file: File) => Promise<void>;
  replaceTaskAttachment: (attachmentId: string, file: File) => Promise<void>;
  downloadTaskAttachment: (attachmentId: string) => Promise<{ blob: Blob; fileName: string }>;
  deleteTaskAttachment: (attachmentId: string) => Promise<void>;
  sendTeamMessage: (body: string) => Promise<void>;
  createChatChannel: (name: string) => Promise<void>;
  startDirectChat: (userId: string) => Promise<string>;
  sendChatMessage: (conversationId: string, body: string) => Promise<void>;
  updateChatMessage: (messageId: string, body: string) => Promise<void>;
  deleteChatMessage: (messageId: string) => Promise<void>;
  updateChatChannel: (conversationId: string, name: string) => Promise<void>;
  deleteChatChannel: (conversationId: string) => Promise<void>;
  saveWorkflowNodePosition: (projectId: string, taskId: string, x: number, y: number) => Promise<void>;
  createWorkflowConnection: (projectId: string, sourceTaskId: string, targetTaskId: string) => Promise<void>;
  deleteWorkflowConnection: (connectionId: string) => Promise<void>;
  moveTask: (taskId: string, status: TaskStatus) => Promise<void>;
  startTimer: (taskId: string) => Promise<void>;
  stopTimer: () => Promise<void>;
  createTimeEntry: (input: CreateTimeEntryInput) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  exportSnapshot: () => Promise<string>;
  importSnapshot: (serialized: string) => Promise<ImportResult>;
  resetWorkspace: () => Promise<void>;
  isMutating: boolean;
  isCreatingTask: boolean;
  isMovingTask: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [activeOrganizationId, setActiveOrganizationId] = useState<string>();
  const [connectionRevision, setConnectionRevision] = useState(0);
  const [cloudUserEmail, setCloudUserEmail] = useState<string>();
  const [isApplyingPublishedConfig, setIsApplyingPublishedConfig] = useState(() => {
    const published = getPublishedSupabaseConfig();
    const current = getSupabaseConfig();
    return Boolean(published && (!current || current.url !== published.url || current.publishableKey !== published.publishableKey));
  });
  const client = useQueryClient();

  const storageMode = getStorageMode();
  const supabaseConfig = getSupabaseConfig();

  const query = useQuery({
    queryKey: ["workspace", activeOrganizationId ?? "default", connectionRevision],
    queryFn: () => workspacePort.getSnapshot(activeOrganizationId),
    enabled: !isApplyingPublishedConfig,
  });

  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["workspace"] });
  };
  const refreshInBackground = () => { void refresh(); };

  // Update the visible workspace immediately and let Supabase reconcile in the background.
  // This keeps small interactions (like checking an item) responsive on high-latency networks.
  const workspaceQueryKey = ["workspace", activeOrganizationId ?? "default", connectionRevision] as const;
  const patchWorkspace = (patch: (current: WorkspaceSnapshot) => WorkspaceSnapshot) => {
    client.setQueryData<WorkspaceSnapshot>(workspaceQueryKey, (current) => current ? patch(current) : current);
  };
  const optimisticallyUpdateTask = (taskId: string, input: UpdateTaskInput) => {
    patchWorkspace((current) => {
      const tasks = current.tasks.map((task) => {
        if (task.id !== taskId) return task;
        const nextStatus = input.status ?? task.status;
        return {
          ...task,
          title: input.title !== undefined ? input.title.trim() : task.title,
          description: input.description !== undefined ? input.description.trim() : task.description,
          status: nextStatus,
          completed: input.status !== undefined ? nextStatus === "done" : task.completed,
          priority: input.priority ?? task.priority,
          dueDate: input.dueDate !== undefined ? input.dueDate || undefined : task.dueDate,
          startDate: input.startDate !== undefined ? input.startDate || undefined : task.startDate,
          estimateMinutes: input.estimateMinutes !== undefined ? Math.max(0, input.estimateMinutes) : task.estimateMinutes,
          assignees: input.assigneeId !== undefined
            ? current.workload.filter((item) => item.person.id === input.assigneeId).map((item) => item.person)
            : task.assignees,
          mode: input.mode ?? task.mode,
        };
      });
      const projects = current.projects.map((project) => {
        const projectTasks = tasks.filter((task) => task.projectId === project.id);
        const completed = projectTasks.filter((task) => task.completed).length;
        return { ...project, progress: projectTasks.length ? Math.round((completed / projectTasks.length) * 100) : 0 };
      });
      return { ...current, tasks, projects };
    });
  };

  const refreshCloudUser = async () => {
    if (getStorageMode() !== "supabase") {
      setCloudUserEmail(undefined);
      return;
    }
    const user = await getSupabaseUser();
    setCloudUserEmail(user?.email ?? undefined);
  };

  useEffect(() => {
    const published = getPublishedSupabaseConfig();
    const current = getSupabaseConfig();
    if (published && (!current || current.url !== published.url || current.publishableKey !== published.publishableKey)) {
      saveSupabaseConfig(published);
      setActiveOrganizationId(undefined);
      setConnectionRevision((currentRevision) => currentRevision + 1);
    }
    setIsApplyingPublishedConfig(false);
  }, []);

  useEffect(() => {
    if (isApplyingPublishedConfig) return;
    void refreshCloudUser();
    if (storageMode !== "supabase") return;
    return onSupabaseAuthChange((event) => {
      void refreshCloudUser();
      void refresh();
      if (event === "PASSWORD_RECOVERY") activatePasswordRecoveryIntent();
      if (event !== "SIGNED_OUT" && isPasswordRecoveryPending()) window.location.hash = "#/reset-password";
      else restoreOAuthReturnPath();
    });
  }, [storageMode, connectionRevision, isApplyingPublishedConfig]);

  useEffect(() => {
    if (storageMode !== "supabase" || !query.data) return;
    return workspacePort.subscribe?.(() => {
      void client.invalidateQueries({ queryKey: ["workspace"] });
    });
  }, [storageMode, query.data?.activeOrganization.id, connectionRevision, client]);

  const workspaceMutation = useMutation({
    mutationFn: (input: CreateWorkspaceInput) => workspacePort.createWorkspace(input),
    onSuccess: refreshInBackground,
  });
  const organizationMutation = useMutation({
    mutationFn: (name: string) => workspacePort.createOrganization(name),
    onSuccess: refreshInBackground,
  });
  const joinOrganizationMutation = useMutation({
    mutationFn: (input: JoinOrganizationInput) => workspacePort.joinOrganization(input),
    onSuccess: refreshInBackground,
  });
  const projectMutation = useMutation({
    mutationFn: (input: CreateProjectInput) => workspacePort.createProject(input),
    onSuccess: refreshInBackground,
  });
  const teamMutation = useMutation({
    mutationFn: (input: CreateTeamInput) => workspacePort.createTeam(input),
    onSuccess: refreshInBackground,
  });
  const deleteTeamMutation = useMutation({
    mutationFn: (teamId: string) => workspacePort.deleteTeam(teamId),
    onSuccess: refreshInBackground,
  });
  const addTeamMemberMutation = useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) => workspacePort.addTeamMember(teamId, userId),
    onSuccess: refreshInBackground,
  });
  const removeTeamMemberMutation = useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) => workspacePort.removeTeamMember(teamId, userId),
    onSuccess: refreshInBackground,
  });
  const updateProjectMutation = useMutation({
    mutationFn: ({ projectId, input }: { projectId: string; input: UpdateProjectInput }) =>
      workspacePort.updateProject(projectId, input),
    onSuccess: refreshInBackground,
  });
  const deleteProjectMutation = useMutation({
    mutationFn: (projectId: string) => workspacePort.deleteProject(projectId),
    onSuccess: refreshInBackground,
  });
  const createMutation = useMutation({
    mutationFn: (input: CreateTaskInput) => workspacePort.createTask(input),
    onSuccess: refreshInBackground,
  });
  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: UpdateTaskInput }) =>
      workspacePort.updateTask(taskId, input),
    onMutate: ({ taskId, input }) => {
      const previous = client.getQueryData<WorkspaceSnapshot>(workspaceQueryKey);
      optimisticallyUpdateTask(taskId, input);
      return { previous };
    },
    onError: (_error, _variables, context) => client.setQueryData(workspaceQueryKey, context?.previous),
    onSuccess: refreshInBackground,
  });
  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => workspacePort.deleteTask(taskId),
    onSuccess: refreshInBackground,
  });
  const moveMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) =>
      workspacePort.moveTask(taskId, status),
    onMutate: ({ taskId, status }) => {
      const previous = client.getQueryData<WorkspaceSnapshot>(workspaceQueryKey);
      optimisticallyUpdateTask(taskId, { status });
      return { previous };
    },
    onError: (_error, _variables, context) => client.setQueryData(workspaceQueryKey, context?.previous),
    onSuccess: refreshInBackground,
  });
  const timerStartMutation = useMutation({
    mutationFn: (taskId: string) => workspacePort.startTimer(taskId),
    onSuccess: refreshInBackground,
  });
  const timerStopMutation = useMutation({
    mutationFn: () => workspacePort.stopTimer(),
    onSuccess: refreshInBackground,
  });
  const timeEntryMutation = useMutation({
    mutationFn: (input: CreateTimeEntryInput) => workspacePort.createTimeEntry(input),
    onSuccess: refreshInBackground,
  });
  const markReadMutation = useMutation({
    mutationFn: () => workspacePort.markAllNotificationsRead(),
    onSuccess: refreshInBackground,
  });
  const importMutation = useMutation({
    mutationFn: (serialized: string) => workspacePort.importSnapshot(serialized),
    onSuccess: refreshInBackground,
  });
  const resetMutation = useMutation({
    mutationFn: () => workspacePort.resetWorkspace(),
    onSuccess: async () => {
      setActiveOrganizationId(undefined);
      await refresh();
    },
  });

  const allMutations = [
    workspaceMutation, organizationMutation, joinOrganizationMutation, projectMutation, teamMutation,
    deleteTeamMutation, addTeamMemberMutation, removeTeamMemberMutation, updateProjectMutation, deleteProjectMutation, createMutation,
    updateTaskMutation, deleteTaskMutation, moveMutation, timerStartMutation, timerStopMutation,
    timeEntryMutation, markReadMutation, importMutation, resetMutation,
  ];

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      snapshot: query.data,
      isLoading: isApplyingPublishedConfig || query.isLoading,
      isError: query.isError,
      error: query.error instanceof Error ? query.error : undefined,
      needsOnboarding: !isApplyingPublishedConfig && !query.isLoading && query.data === null,
      activeOrganizationId,
      storageMode,
      supabaseConfig,
      cloudUserEmail,
      switchOrganization: setActiveOrganizationId,
      refetch: () => void query.refetch(),
      connectSupabase: async (config) => {
        const result = await probeSupabase(config);
        if (result.connected) {
          saveSupabaseConfig(config);
          setActiveOrganizationId(undefined);
          setConnectionRevision((current) => current + 1);
          await client.invalidateQueries({ queryKey: ["workspace"] });
          await refreshCloudUser();
        }
        return result;
      },
      disconnectSupabase: async () => {
        if (getStorageMode() === "supabase" && getSupabaseConfig()) {
          try { await signOutSupabase(); } catch { /* desconectar incluso si Auth ya expiró */ }
        }
        useLocalMode();
        setCloudUserEmail(undefined);
        setActiveOrganizationId(undefined);
        setConnectionRevision((current) => current + 1);
        await client.invalidateQueries({ queryKey: ["workspace"] });
      },
      signUpCloud: async (email, password) => {
        const config = getSupabaseConfig();
        if (!config) throw new Error("Primero conecta tu proyecto Supabase.");
        const result = await signUpWithPassword(config, email, password);
        await refreshCloudUser();
        await refresh();
        return { needsEmailConfirmation: !result.session };
      },
      signInCloud: async (email, password) => {
        const config = getSupabaseConfig();
        if (!config) throw new Error("Primero conecta tu proyecto Supabase.");
        await signInWithPassword(config, email, password);
        await refreshCloudUser();
        await refresh();
      },
      signInGoogleCloud: async (returnHash) => {
        const config = getSupabaseConfig();
        if (!config) throw new Error("Primero conecta tu proyecto Supabase.");
        await signInWithGoogle(config, returnHash);
      },
      requestPasswordRecovery: async (email) => {
        const config = getSupabaseConfig();
        if (!config) throw new Error("Primero conecta tu proyecto Supabase.");
        await requestPasswordRecovery(config, email);
      },
      updateCloudPassword: async (password) => {
        const config = getSupabaseConfig();
        if (!config) throw new Error("Primero conecta tu proyecto Supabase.");
        await updateSupabasePassword(config, password);
        await refreshCloudUser();
      },
      signOutCloud: async () => {
        await signOutSupabase();
        setCloudUserEmail(undefined);
        await refresh();
      },
      joinOrganization: async (input) => {
        await joinOrganizationMutation.mutateAsync(input);
      },
      rotateInviteCode: () => workspacePort.rotateInviteCode(),
      createWorkspace: async (input) => { await workspaceMutation.mutateAsync(input); },
      createOrganization: async (name) => { await organizationMutation.mutateAsync(name); },
      createProject: async (input) => { await projectMutation.mutateAsync(input); },
      createTeam: async (input) => { await teamMutation.mutateAsync(input); },
      deleteTeam: async (teamId) => { await deleteTeamMutation.mutateAsync(teamId); },
      addTeamMember: async (teamId, userId) => { await addTeamMemberMutation.mutateAsync({ teamId, userId }); },
      removeTeamMember: async (teamId, userId) => { await removeTeamMemberMutation.mutateAsync({ teamId, userId }); },
      updateProject: async (projectId, input) => { await updateProjectMutation.mutateAsync({ projectId, input }); },
      deleteProject: async (projectId) => { await deleteProjectMutation.mutateAsync(projectId); },
      createTask: (input) => createMutation.mutateAsync(input),
      updateTask: async (taskId, input) => { await updateTaskMutation.mutateAsync({ taskId, input }); },
      deleteTask: async (taskId) => { await deleteTaskMutation.mutateAsync(taskId); },
      addTaskMessage: async (taskId, body) => { await workspacePort.addTaskMessage(taskId, body); void refresh(); },
      addChecklistItem: async (taskId, text) => { await workspacePort.addChecklistItem(taskId, text); void refresh(); },
      setChecklistItemCompleted: async (itemId, completed) => {
        const previous = client.getQueryData<WorkspaceSnapshot>(workspaceQueryKey);
        patchWorkspace((current) => ({
          ...current,
          tasks: current.tasks.map((task) => task.checklist.some((item) => item.id === itemId)
            ? { ...task, checklist: task.checklist.map((item) => item.id === itemId ? { ...item, completed } : item) }
            : task),
        }));
        try {
          await workspacePort.setChecklistItemCompleted(itemId, completed);
          void refresh();
        } catch (cause) {
          client.setQueryData(workspaceQueryKey, previous);
          throw cause;
        }
      },
      deleteChecklistItem: async (itemId) => { await workspacePort.deleteChecklistItem(itemId); void refresh(); },
      uploadTaskAttachment: async (taskId, file) => { await workspacePort.uploadTaskAttachment(taskId, file); void refresh(); },
      replaceTaskAttachment: async (attachmentId, file) => { await workspacePort.replaceTaskAttachment(attachmentId, file); void refresh(); },
      downloadTaskAttachment: async (attachmentId) => {
        const result = await workspacePort.downloadTaskAttachment(attachmentId);
        void refresh();
        return result;
      },
      deleteTaskAttachment: async (attachmentId) => { await workspacePort.deleteTaskAttachment(attachmentId); void refresh(); },
      sendTeamMessage: async (body) => { await workspacePort.sendTeamMessage(body); void refresh(); },
      createChatChannel: async (name) => {
        const conversationId = await workspacePort.createChatChannel(name);
        patchWorkspace((current) => current.chatConversations.some((conversation) => conversation.id === conversationId) ? current : ({
          ...current,
          chatConversations: [...current.chatConversations, {
            id: conversationId,
            type: "channel",
            name: name.trim().replace(/^#/, ""),
            participants: [current.currentUser],
            createdBy: current.currentUser.id,
            createdAt: new Date().toISOString(),
          }],
        }));
        void refresh();
      },
      startDirectChat: async (userId) => {
        const conversationId = await workspacePort.startDirectChat(userId);
        patchWorkspace((current) => {
          if (current.chatConversations.some((conversation) => conversation.id === conversationId)) return current;
          const target = current.workload.find((item) => item.person.id === userId)?.person;
          if (!target) return current;
          return {
            ...current,
            chatConversations: [...current.chatConversations, {
              id: conversationId,
              type: "direct",
              name: target.name,
              participants: [current.currentUser, target],
              createdBy: current.currentUser.id,
              createdAt: new Date().toISOString(),
            }],
          };
        });
        void refresh();
        return conversationId;
      },
      sendChatMessage: async (conversationId, body) => {
        const temporaryId = `pending-${crypto.randomUUID()}`;
        patchWorkspace((current) => ({
          ...current,
          chatMessages: [...current.chatMessages, {
            id: temporaryId,
            conversationId,
            body: body.trim(),
            author: current.currentUser,
            createdAt: new Date().toISOString(),
          }],
        }));
        try {
          await workspacePort.sendChatMessage(conversationId, body);
          void refresh();
        } catch (cause) {
          patchWorkspace((current) => ({
            ...current,
            chatMessages: current.chatMessages.filter((message) => message.id !== temporaryId),
          }));
          throw cause;
        }
      },
      updateChatMessage: async (messageId, body) => {
        const previous = client.getQueryData<WorkspaceSnapshot>(workspaceQueryKey);
        patchWorkspace((current) => ({
          ...current,
          chatMessages: current.chatMessages.map((message) => message.id === messageId
            ? { ...message, body: body.trim(), updatedAt: new Date().toISOString() }
            : message),
        }));
        try {
          await workspacePort.updateChatMessage(messageId, body);
          void refresh();
        } catch (cause) {
          client.setQueryData(workspaceQueryKey, previous);
          throw cause;
        }
      },
      deleteChatMessage: async (messageId) => {
        const previous = client.getQueryData<WorkspaceSnapshot>(workspaceQueryKey);
        patchWorkspace((current) => ({ ...current, chatMessages: current.chatMessages.filter((message) => message.id !== messageId) }));
        try {
          await workspacePort.deleteChatMessage(messageId);
          void refresh();
        } catch (cause) {
          client.setQueryData(workspaceQueryKey, previous);
          throw cause;
        }
      },
      updateChatChannel: async (conversationId, name) => {
        const previous = client.getQueryData<WorkspaceSnapshot>(workspaceQueryKey);
        const normalized = name.trim().replace(/^#/, "");
        patchWorkspace((current) => ({
          ...current,
          chatConversations: current.chatConversations.map((conversation) => conversation.id === conversationId ? { ...conversation, name: normalized } : conversation),
        }));
        try {
          await workspacePort.updateChatChannel(conversationId, normalized);
          void refresh();
        } catch (cause) {
          client.setQueryData(workspaceQueryKey, previous);
          throw cause;
        }
      },
      deleteChatChannel: async (conversationId) => {
        const previous = client.getQueryData<WorkspaceSnapshot>(workspaceQueryKey);
        patchWorkspace((current) => ({
          ...current,
          chatConversations: current.chatConversations.filter((conversation) => conversation.id !== conversationId),
          chatMessages: current.chatMessages.filter((message) => message.conversationId !== conversationId),
        }));
        try {
          await workspacePort.deleteChatChannel(conversationId);
          void refresh();
        } catch (cause) {
          client.setQueryData(workspaceQueryKey, previous);
          throw cause;
        }
      },
      saveWorkflowNodePosition: async (projectId, taskId, x, y) => { await workspacePort.saveWorkflowNodePosition(projectId, taskId, x, y); void refresh(); },
      createWorkflowConnection: async (projectId, sourceTaskId, targetTaskId) => { await workspacePort.createWorkflowConnection(projectId, sourceTaskId, targetTaskId); void refresh(); },
      deleteWorkflowConnection: async (connectionId) => { await workspacePort.deleteWorkflowConnection(connectionId); void refresh(); },
      moveTask: async (taskId, status) => { await moveMutation.mutateAsync({ taskId, status }); },
      startTimer: async (taskId) => { await timerStartMutation.mutateAsync(taskId); },
      stopTimer: async () => { await timerStopMutation.mutateAsync(); },
      createTimeEntry: async (input) => { await timeEntryMutation.mutateAsync(input); },
      markAllNotificationsRead: async () => { await markReadMutation.mutateAsync(); },
      exportSnapshot: () => workspacePort.exportSnapshot(),
      importSnapshot: (serialized) => importMutation.mutateAsync(serialized),
      resetWorkspace: async () => { await resetMutation.mutateAsync(); },
      isMutating: allMutations.some((mutation) => mutation.isPending),
      isCreatingTask: createMutation.isPending,
      isMovingTask: moveMutation.isPending,
    }),
    [
      query.data, query.isLoading, query.isError, query.error, query.refetch,
      isApplyingPublishedConfig,
      activeOrganizationId, storageMode, supabaseConfig?.url, supabaseConfig?.publishableKey,
      cloudUserEmail, connectionRevision, client,
      workspaceMutation, organizationMutation, joinOrganizationMutation, projectMutation,
      teamMutation, deleteTeamMutation, addTeamMemberMutation, removeTeamMemberMutation, updateProjectMutation, deleteProjectMutation,
      createMutation, updateTaskMutation, deleteTaskMutation, moveMutation,
      timerStartMutation, timerStopMutation, timeEntryMutation, markReadMutation,
      importMutation, resetMutation,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <WorkspaceProvider>{children}</WorkspaceProvider>
    </QueryClientProvider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace debe usarse dentro de AppProviders.");
  return context;
}

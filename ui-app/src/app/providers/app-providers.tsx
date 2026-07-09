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
  UpdateProjectInput,
  UpdateTaskInput,
  WorkspaceSnapshot,
} from "../../application/ports/workspace-port";
import {
  getStorageMode,
  getSupabaseConfig,
  getSupabaseUser,
  onSupabaseAuthChange,
  probeSupabase,
  saveSupabaseConfig,
  signInWithPassword,
  signOutSupabase,
  signUpWithPassword,
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
  createTask: (input: CreateTaskInput) => Promise<void>;
  updateTask: (taskId: string, input: UpdateTaskInput) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
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
  const client = useQueryClient();

  const storageMode = getStorageMode();
  const supabaseConfig = getSupabaseConfig();

  const query = useQuery({
    queryKey: ["workspace", activeOrganizationId ?? "default", connectionRevision],
    queryFn: () => workspacePort.getSnapshot(activeOrganizationId),
  });

  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["workspace"] });
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
    void refreshCloudUser();
    if (storageMode !== "supabase") return;
    return onSupabaseAuthChange(() => {
      void refreshCloudUser();
      void refresh();
    });
  }, [storageMode, connectionRevision]);

  useEffect(() => {
    if (storageMode !== "supabase" || !query.data) return;
    return workspacePort.subscribe?.(() => {
      void client.invalidateQueries({ queryKey: ["workspace"] });
    });
  }, [storageMode, query.data?.activeOrganization.id, connectionRevision, client]);

  const workspaceMutation = useMutation({
    mutationFn: (input: CreateWorkspaceInput) => workspacePort.createWorkspace(input),
    onSuccess: refresh,
  });
  const organizationMutation = useMutation({
    mutationFn: (name: string) => workspacePort.createOrganization(name),
    onSuccess: refresh,
  });
  const joinOrganizationMutation = useMutation({
    mutationFn: (input: JoinOrganizationInput) => workspacePort.joinOrganization(input),
    onSuccess: refresh,
  });
  const projectMutation = useMutation({
    mutationFn: (input: CreateProjectInput) => workspacePort.createProject(input),
    onSuccess: refresh,
  });
  const teamMutation = useMutation({
    mutationFn: (input: CreateTeamInput) => workspacePort.createTeam(input),
    onSuccess: refresh,
  });
  const deleteTeamMutation = useMutation({
    mutationFn: (teamId: string) => workspacePort.deleteTeam(teamId),
    onSuccess: refresh,
  });
  const addTeamMemberMutation = useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) => workspacePort.addTeamMember(teamId, userId),
    onSuccess: refresh,
  });
  const removeTeamMemberMutation = useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) => workspacePort.removeTeamMember(teamId, userId),
    onSuccess: refresh,
  });
  const updateProjectMutation = useMutation({
    mutationFn: ({ projectId, input }: { projectId: string; input: UpdateProjectInput }) =>
      workspacePort.updateProject(projectId, input),
    onSuccess: refresh,
  });
  const deleteProjectMutation = useMutation({
    mutationFn: (projectId: string) => workspacePort.deleteProject(projectId),
    onSuccess: refresh,
  });
  const createMutation = useMutation({
    mutationFn: (input: CreateTaskInput) => workspacePort.createTask(input),
    onSuccess: refresh,
  });
  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: UpdateTaskInput }) =>
      workspacePort.updateTask(taskId, input),
    onSuccess: refresh,
  });
  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => workspacePort.deleteTask(taskId),
    onSuccess: refresh,
  });
  const moveMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) =>
      workspacePort.moveTask(taskId, status),
    onSuccess: refresh,
  });
  const timerStartMutation = useMutation({
    mutationFn: (taskId: string) => workspacePort.startTimer(taskId),
    onSuccess: refresh,
  });
  const timerStopMutation = useMutation({
    mutationFn: () => workspacePort.stopTimer(),
    onSuccess: refresh,
  });
  const timeEntryMutation = useMutation({
    mutationFn: (input: CreateTimeEntryInput) => workspacePort.createTimeEntry(input),
    onSuccess: refresh,
  });
  const markReadMutation = useMutation({
    mutationFn: () => workspacePort.markAllNotificationsRead(),
    onSuccess: refresh,
  });
  const importMutation = useMutation({
    mutationFn: (serialized: string) => workspacePort.importSnapshot(serialized),
    onSuccess: refresh,
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
      isLoading: query.isLoading,
      isError: query.isError,
      error: query.error instanceof Error ? query.error : undefined,
      needsOnboarding: !query.isLoading && query.data === null,
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
      createTask: async (input) => { await createMutation.mutateAsync(input); },
      updateTask: async (taskId, input) => { await updateTaskMutation.mutateAsync({ taskId, input }); },
      deleteTask: async (taskId) => { await deleteTaskMutation.mutateAsync(taskId); },
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

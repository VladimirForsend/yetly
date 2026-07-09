import type { RealtimeChannel, SupabaseClient, User } from "@supabase/supabase-js";
import type {
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
  ProjectStatus,
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
import {
  getSupabaseClient,
  projectRefFromUrl,
  type SupabaseConnectionConfig,
} from "./supabase-connection";

type Row = Record<string, any>;

const accents = ["#6d5dfc", "#2563eb", "#0f766e", "#b45309", "#be123c", "#7c3aed"];

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

function mondayOfCurrentWeek() {
  const date = new Date();
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date;
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
  return `Hace ${Math.floor(hours / 24)} d`;
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

function asError(error: { message?: string } | null, fallback: string) {
  return new Error(error?.message || fallback);
}

function healthFor(project: Row, tasks: Row[]): { health: ProjectHealth; reason: string } {
  const projectTasks = tasks.filter((task) => task.project_id === project.id);
  if (project.status === "completed") return { health: "green", reason: "Proyecto completado." };
  if (!projectTasks.length) return { health: "unknown", reason: "Aún no hay tareas para evaluar la salud." };
  const now = todayIsoDate();
  const overdue = projectTasks.filter((task) => !task.completed && task.due_date && task.due_date < now).length;
  const urgent = projectTasks.filter((task) => !task.completed && task.priority === "urgent").length;
  if (overdue > 0) return { health: "red", reason: `${overdue} tarea${overdue === 1 ? "" : "s"} vencida${overdue === 1 ? "" : "s"}.` };
  if (urgent > 0) return { health: "yellow", reason: `${urgent} tarea${urgent === 1 ? "" : "s"} urgente${urgent === 1 ? "" : "s"} abierta${urgent === 1 ? "" : "s"}.` };
  return { health: "green", reason: "Sin vencimientos ni urgencias abiertas." };
}

function personFromProfile(profile: Row | undefined, fallbackId: string, fallbackEmail = "Usuario"): PersonSummary {
  const name = profile?.full_name?.trim() || fallbackEmail.split("@")[0] || "Usuario";
  return {
    id: fallbackId,
    name,
    initials: initials(name),
    role: profile?.role_title || "Member",
    avatarTone: "bg-brand-100 text-brand-700",
  };
}

export class SupabaseWorkspaceAdapter implements WorkspacePort {
  private readonly client: SupabaseClient;
  private readonly config: SupabaseConnectionConfig;

  constructor(config: SupabaseConnectionConfig) {
    this.config = config;
    this.client = getSupabaseClient(config);
  }

  private async requireUser(): Promise<User> {
    const { data, error } = await this.client.auth.getUser();
    if (error || !data.user) throw new Error("Inicia sesión en Supabase para continuar.");
    return data.user;
  }

  private activeOrgKey(userId: string) {
    const ref = projectRefFromUrl(this.config.url) || "custom";
    return `yetly:supabase:active-org:${ref}:${userId}`;
  }

  private async activity(orgId: string, userId: string, action: string, objectLabel: string) {
    const { error } = await this.client.from("activities").insert({
      organization_id: orgId,
      actor_id: userId,
      action,
      object_label: objectLabel,
    });
    if (error) console.warn("Yetly: no se pudo registrar actividad", error.message);
  }

  private async resolveActiveOrg(organizationId?: string) {
    const { data: authData, error: authError } = await this.client.auth.getUser();
    if (authError || !authData.user) return { user: null as User | null, memberships: [] as Row[], activeId: "" };
    const user = authData.user;
    const { data: memberships, error: membershipError } = await this.client
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", user.id);

    if (membershipError) {
      const text = `${membershipError.code ?? ""} ${membershipError.message ?? ""}`.toLowerCase();
      if (text.includes("pgrst205") || text.includes("42p01") || text.includes("schema cache")) {
        return { user, memberships: [] as Row[], activeId: "" };
      }
      throw asError(membershipError, "No pudimos leer tus organizaciones.");
    }
    if (!memberships?.length) return { user, memberships: [] as Row[], activeId: "" };

    const allowed = new Set(memberships.map((item: Row) => item.organization_id as string));
    const stored = window.localStorage.getItem(this.activeOrgKey(user.id));
    const activeId = organizationId && allowed.has(organizationId)
      ? organizationId
      : stored && allowed.has(stored)
        ? stored
        : memberships[0].organization_id;

    window.localStorage.setItem(this.activeOrgKey(user.id), activeId);
    return { user, memberships: memberships as Row[], activeId };
  }

  async getSnapshot(organizationId?: string): Promise<WorkspaceSnapshot | null> {
    const { user, memberships, activeId } = await this.resolveActiveOrg(organizationId);
    if (!user || !memberships.length || !activeId) return null;

    const orgIds = memberships.map((membership) => membership.organization_id);
    const [
      orgResult,
      profileResult,
      teamsResult,
      orgMembersResult,
      projectsResult,
      tasksResult,
      entriesResult,
      activitiesResult,
      timerResult,
    ] = await Promise.all([
      this.client.from("organizations").select("id,name,color,invite_code").in("id", orgIds),
      this.client.from("profiles").select("id,full_name,role_title").eq("id", user.id).maybeSingle(),
      this.client.from("teams").select("id,organization_id,name").eq("organization_id", activeId).order("created_at"),
      this.client.from("organization_members").select("organization_id,user_id,role").eq("organization_id", activeId),
      this.client.from("projects").select("*").eq("organization_id", activeId).order("created_at", { ascending: false }),
      this.client.from("tasks").select("*").eq("organization_id", activeId).order("created_at", { ascending: false }),
      this.client.from("time_entries").select("*").eq("organization_id", activeId).order("created_at", { ascending: false }),
      this.client.from("activities").select("*").eq("organization_id", activeId).order("occurred_at", { ascending: false }).limit(20),
      this.client.from("active_timers").select("*").eq("user_id", user.id).maybeSingle(),
    ]);

    const firstError = [
      orgResult.error, profileResult.error, teamsResult.error, orgMembersResult.error,
      projectsResult.error, tasksResult.error, entriesResult.error, activitiesResult.error, timerResult.error,
    ].find(Boolean);
    if (firstError) throw asError(firstError, "No pudimos cargar el workspace cloud.");

    const memberIds = (orgMembersResult.data ?? []).map((row: Row) => row.user_id as string);
    const teamIds = (teamsResult.data ?? []).map((row: Row) => row.id as string);

    const [profilesResult, teamMembersResult] = await Promise.all([
      memberIds.length
        ? this.client.from("profiles").select("id,full_name,role_title").in("id", memberIds)
        : Promise.resolve({ data: [], error: null }),
      teamIds.length
        ? this.client.from("team_members").select("team_id,user_id,role").in("team_id", teamIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (profilesResult.error) throw asError(profilesResult.error, "No pudimos leer los perfiles.");
    if (teamMembersResult.error) throw asError(teamMembersResult.error, "No pudimos leer los miembros de equipo.");

    const profileRows = profilesResult.data as Row[] ?? [];
    const profiles = new Map<string, PersonSummary>(
      profileRows.map((profile) => [profile.id as string, personFromProfile(profile, profile.id)]),
    );
    const currentUser = profiles.get(user.id)
      ?? personFromProfile(profileResult.data as Row | undefined, user.id, user.email);

    const membershipRole = new Map<string, string>(
      memberships.map((membership) => [membership.organization_id, membership.role]),
    );
    const organizations: OrganizationSummary[] = (orgResult.data as Row[] ?? []).map((org) => ({
      id: org.id,
      name: org.name,
      initials: initials(org.name),
      color: org.color || "#6d5dfc",
      inviteCode: org.invite_code,
      memberRole: membershipRole.get(org.id) as OrganizationSummary["memberRole"],
    }));
    const activeOrganization = organizations.find((org) => org.id === activeId) ?? organizations[0];
    if (!activeOrganization) return null;

    const teamsRows = teamsResult.data as Row[] ?? [];
    const teamMembers = teamMembersResult.data as Row[] ?? [];
    const teams: TeamSummary[] = teamsRows.map((team) => ({
      id: team.id,
      name: team.name,
      members: teamMembers
        .filter((membership) => membership.team_id === team.id)
        .map((membership) => profiles.get(membership.user_id))
        .filter((person): person is PersonSummary => Boolean(person)),
    }));
    const teamById = new Map(teamsRows.map((team) => [team.id, team.name]));

    const projectRows = projectsResult.data as Row[] ?? [];
    const taskRows = tasksResult.data as Row[] ?? [];
    const entryRows = entriesResult.data as Row[] ?? [];

    const actualByTask = new Map<string, number>();
    for (const entry of entryRows) {
      if (!entry.task_id) continue;
      actualByTask.set(entry.task_id, (actualByTask.get(entry.task_id) ?? 0) + Number(entry.duration_minutes || 0));
    }

    const projects: ProjectSummary[] = projectRows.map((project) => {
      const projectTasks = taskRows.filter((task) => task.project_id === project.id);
      const done = projectTasks.filter((task) => task.completed).length;
      const health = healthFor(project, projectTasks);
      return {
        id: project.id,
        code: project.code,
        name: project.name,
        owner: profiles.get(project.created_by) ?? currentUser,
        status: project.status as ProjectStatus,
        health: health.health,
        healthReason: health.reason,
        progress: projectTasks.length ? Math.round((done / projectTasks.length) * 100) : 0,
        targetDate: project.target_date || "Sin fecha objetivo",
        actualMinutes: entryRows
          .filter((entry) => entry.project_id === project.id)
          .reduce((sum, entry) => sum + Number(entry.duration_minutes || 0), 0),
        estimateMinutes: projectTasks.reduce((sum, task) => sum + Number(task.estimate_minutes || 0), 0),
        teamName: teamById.get(project.team_id) ?? "General",
        accent: project.accent || "#6d5dfc",
      };
    });
    const projectById = new Map(projects.map((project) => [project.id, project]));

    const tasks: TaskSummary[] = taskRows.map((task) => ({
      id: task.id,
      projectId: task.project_id,
      projectCode: projectById.get(task.project_id)?.code ?? "PRJ",
      title: task.title,
      description: task.description || "",
      status: task.status as TaskStatus,
      priority: task.priority,
      dueDate: task.due_date || undefined,
      startDate: task.start_date || undefined,
      estimateMinutes: Number(task.estimate_minutes || 0),
      actualMinutes: actualByTask.get(task.id) ?? 0,
      assignees: task.assignee_id && profiles.has(task.assignee_id)
        ? [profiles.get(task.assignee_id)!]
        : [],
      labels: Array.isArray(task.labels) ? task.labels : [],
      blockedReason: task.blocked_reason || undefined,
      completed: Boolean(task.completed),
    }));

    const workload = memberIds.map((memberId) => {
      const person = profiles.get(memberId) ?? personFromProfile(undefined, memberId);
      const assignedTasks = taskRows.filter((task) => !task.completed && task.assignee_id === memberId);
      const memberTeam = teams.find((team) => team.members.some((member) => member.id === memberId));
      return {
        person,
        capacityMinutes: 2400,
        assignedMinutes: assignedTasks.reduce((sum, task) => sum + Number(task.estimate_minutes || 0), 0),
        taskCount: assignedTasks.length,
        teamName: memberTeam?.name ?? "Sin equipo",
      };
    });

    const weekStart = mondayOfCurrentWeek();
    const weeklyTime = ["Lun", "Mar", "Mié", "Jue", "Vie"].map((day, index) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      const key = date.toISOString().slice(0, 10);
      return {
        day,
        minutes: entryRows
          .filter((entry) => entry.user_id === user.id && entry.work_date === key)
          .reduce((sum, entry) => sum + Number(entry.duration_minutes || 0), 0),
      };
    });

    const notifications: WorkspaceSnapshot["notifications"] = [];
    const today = todayIsoDate();
    for (const task of tasks.filter((item) => !item.completed)) {
      if (task.dueDate && task.dueDate < today) {
        notifications.push({
          id: `overdue-${task.id}`,
          title: "Tarea vencida",
          description: `${task.title} venció el ${task.dueDate}.`,
          unread: true,
          tone: "danger",
        });
      } else if (task.priority === "urgent") {
        notifications.push({
          id: `urgent-${task.id}`,
          title: "Tarea urgente abierta",
          description: task.title,
          unread: true,
          tone: "warning",
        });
      }
    }

    const timer = timerResult.data as Row | null;
    const timerTask = timer ? tasks.find((task) => task.id === timer.task_id) : undefined;

    return {
      activeOrganization,
      organizations,
      currentUser,
      projects,
      tasks,
      teams,
      workload,
      activities: (activitiesResult.data as Row[] ?? []).map((item) => ({
        id: item.id,
        actor: profiles.get(item.actor_id) ?? currentUser,
        action: item.action,
        objectLabel: item.object_label,
        timestampLabel: relativeLabel(item.occurred_at),
      })),
      notifications: notifications.slice(0, 50),
      weeklyTime,
      timeEntries: entryRows.map((entry): TimeEntrySummary => ({
        id: entry.id,
        projectId: entry.project_id,
        taskId: entry.task_id || undefined,
        workDate: entry.work_date,
        durationMinutes: Number(entry.duration_minutes),
        note: entry.note || "",
        source: entry.source,
      })),
      activeTimer: timer && timerTask ? {
        taskId: timerTask.id,
        taskTitle: timerTask.title,
        startedAtIso: timer.started_at,
        elapsedLabel: elapsedLabel(timer.started_at),
      } : undefined,
    };
  }

  async createWorkspace(input: CreateWorkspaceInput): Promise<WorkspaceSnapshot> {
    assertText(input.userName, "Tu nombre");
    assertText(input.organizationName, "El nombre de la organización");
    const { error } = await this.client.rpc("yetly_create_organization", {
      org_name: input.organizationName.trim(),
      user_name: input.userName.trim(),
      role_name: input.role?.trim() || "Owner",
    });
    if (error) throw asError(error, "No pudimos crear la organización.");
    const snapshot = await this.getSnapshot();
    if (!snapshot) throw new Error("La organización se creó, pero no pudimos abrirla.");
    return snapshot;
  }

  async createOrganization(name: string): Promise<OrganizationSummary> {
    assertText(name, "El nombre de la organización");
    const user = await this.requireUser();
    const snapshot = await this.getSnapshot();
    const { data, error } = await this.client.rpc("yetly_create_organization", {
      org_name: name.trim(),
      user_name: snapshot?.currentUser.name || user.email?.split("@")[0] || "Usuario",
      role_name: snapshot?.currentUser.role || "Owner",
    });
    if (error) throw asError(error, "No pudimos crear la organización.");
    const next = await this.getSnapshot(data as string);
    if (!next) throw new Error("La organización se creó, pero no pudimos cargarla.");
    return next.activeOrganization;
  }

  async joinOrganization(input: JoinOrganizationInput): Promise<OrganizationSummary> {
    assertText(input.inviteCode, "El código de invitación", 4);
    assertText(input.userName, "Tu nombre");
    const { data, error } = await this.client.rpc("yetly_join_organization", {
      invite: input.inviteCode.trim(),
      user_name: input.userName.trim(),
      role_name: input.role?.trim() || "Member",
    });
    if (error) throw asError(error, "No pudimos unirnos a la organización.");
    const next = await this.getSnapshot(data as string);
    if (!next) throw new Error("Te uniste, pero no pudimos cargar el workspace.");
    return next.activeOrganization;
  }

  async rotateInviteCode(): Promise<string> {
    const snapshot = await this.getSnapshot();
    if (!snapshot) throw new Error("No hay organización activa.");
    const { data, error } = await this.client.rpc("yetly_rotate_invite_code", {
      target_org: snapshot.activeOrganization.id,
    });
    if (error) throw asError(error, "No pudimos renovar el código.");
    return String(data);
  }

  private async ensureTeam(orgId: string, nameInput?: string) {
    const name = nameInput?.trim() || "General";
    const { data: existing, error: readError } = await this.client
      .from("teams")
      .select("id,name")
      .eq("organization_id", orgId)
      .ilike("name", name)
      .maybeSingle();
    if (readError) throw asError(readError, "No pudimos consultar el equipo.");
    if (existing) return existing as Row;

    const user = await this.requireUser();
    const { data, error } = await this.client
      .from("teams")
      .insert({ organization_id: orgId, name })
      .select("id,name")
      .single();
    if (error) throw asError(error, "No pudimos crear el equipo.");
    const { error: memberError } = await this.client
      .from("team_members")
      .insert({ team_id: data.id, user_id: user.id, role: "lead" });
    if (memberError) console.warn("Yetly: equipo creado sin membresía automática", memberError.message);
    return data as Row;
  }

  async createProject(input: CreateProjectInput): Promise<ProjectSummary> {
    assertText(input.name, "El nombre del proyecto");
    const user = await this.requireUser();
    const snapshot = await this.getSnapshot();
    if (!snapshot) throw new Error("No hay organización activa.");
    const orgId = snapshot.activeOrganization.id;
    const team = await this.ensureTeam(orgId, input.teamName);
    const baseCode = normalizeCode(input.code ?? "") || projectCode(input.name, snapshot.projects.length);
    let code = baseCode;
    let suffix = 2;
    while (snapshot.projects.some((project) => project.code === code)) code = `${baseCode.slice(0, 6)}${suffix++}`;

    const { data, error } = await this.client.from("projects").insert({
      organization_id: orgId,
      team_id: team.id,
      code,
      name: input.name.trim(),
      status: input.status ?? "active",
      target_date: input.targetDate || null,
      accent: accents[snapshot.projects.length % accents.length],
      created_by: user.id,
    }).select("id").single();
    if (error) throw asError(error, "No pudimos crear el proyecto.");
    await this.activity(orgId, user.id, "creó el proyecto", input.name.trim());
    const next = await this.getSnapshot();
    return next!.projects.find((project) => project.id === data.id)!;
  }

  async updateProject(projectId: string, input: UpdateProjectInput): Promise<ProjectSummary> {
    const snapshot = await this.getSnapshot();
    if (!snapshot) throw new Error("No hay organización activa.");
    const payload: Row = { updated_at: new Date().toISOString() };
    if (input.name !== undefined) {
      assertText(input.name, "El nombre del proyecto");
      payload.name = input.name.trim();
    }
    if (input.status !== undefined) payload.status = input.status;
    if (input.targetDate !== undefined) payload.target_date = input.targetDate || null;
    if (input.teamName !== undefined) {
      const team = await this.ensureTeam(snapshot.activeOrganization.id, input.teamName);
      payload.team_id = team.id;
    }
    const { error } = await this.client.from("projects").update(payload).eq("id", projectId);
    if (error) throw asError(error, "No pudimos actualizar el proyecto.");
    const user = await this.requireUser();
    await this.activity(snapshot.activeOrganization.id, user.id, "actualizó el proyecto", input.name || "Proyecto");
    const next = await this.getSnapshot();
    const project = next?.projects.find((item) => item.id === projectId);
    if (!project) throw new Error("No pudimos recuperar el proyecto actualizado.");
    return project;
  }

  async deleteProject(projectId: string): Promise<void> {
    const snapshot = await this.getSnapshot();
    const project = snapshot?.projects.find((item) => item.id === projectId);
    const { error } = await this.client.from("projects").delete().eq("id", projectId);
    if (error) throw asError(error, "No pudimos eliminar el proyecto.");
    if (snapshot && project) {
      const user = await this.requireUser();
      await this.activity(snapshot.activeOrganization.id, user.id, "eliminó el proyecto", project.name);
    }
  }

  async createTeam(input: CreateTeamInput): Promise<TeamSummary> {
    assertText(input.name, "El nombre del equipo");
    const snapshot = await this.getSnapshot();
    if (!snapshot) throw new Error("No hay organización activa.");
    const team = await this.ensureTeam(snapshot.activeOrganization.id, input.name);
    const next = await this.getSnapshot();
    return next!.teams.find((item) => item.id === team.id)!;
  }

  async deleteTeam(teamId: string): Promise<void> {
    const { count, error: projectError } = await this.client
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId);
    if (projectError) throw asError(projectError, "No pudimos validar el equipo.");
    if ((count ?? 0) > 0) throw new Error("No puedes eliminar un equipo con proyectos asociados.");
    const { error } = await this.client.from("teams").delete().eq("id", teamId);
    if (error) throw asError(error, "No pudimos eliminar el equipo.");
  }

  async addTeamMember(teamId: string, userId: string): Promise<void> {
    const { error } = await this.client
      .from("team_members")
      .upsert({ team_id: teamId, user_id: userId, role: "member" }, { onConflict: "team_id,user_id", ignoreDuplicates: true });
    if (error) throw asError(error, "No pudimos agregar la persona al equipo.");
  }

  async removeTeamMember(teamId: string, userId: string): Promise<void> {
    const { error } = await this.client
      .from("team_members")
      .delete()
      .eq("team_id", teamId)
      .eq("user_id", userId);
    if (error) throw asError(error, "No pudimos quitar la persona del equipo.");
  }

  async createTask(input: CreateTaskInput): Promise<TaskSummary> {
    assertText(input.title, "El título de la tarea");
    const user = await this.requireUser();
    const snapshot = await this.getSnapshot();
    if (!snapshot) throw new Error("No hay organización activa.");
    if (!snapshot.projects.some((project) => project.id === input.projectId)) throw new Error("Selecciona un proyecto válido.");
    const completed = input.status === "done";
    const { data, error } = await this.client.from("tasks").insert({
      organization_id: snapshot.activeOrganization.id,
      project_id: input.projectId,
      title: input.title.trim(),
      description: input.description?.trim() || "",
      status: input.status,
      priority: input.priority,
      due_date: input.dueDate || null,
      start_date: input.startDate || null,
      estimate_minutes: Math.max(0, input.estimateMinutes ?? 0),
      assignee_id: input.assigneeId || user.id,
      completed,
      created_by: user.id,
    }).select("id").single();
    if (error) throw asError(error, "No pudimos crear la tarea.");
    await this.activity(snapshot.activeOrganization.id, user.id, "creó la tarea", input.title.trim());
    const next = await this.getSnapshot();
    return next!.tasks.find((task) => task.id === data.id)!;
  }

  async updateTask(taskId: string, input: UpdateTaskInput): Promise<TaskSummary> {
    const payload: Row = { updated_at: new Date().toISOString() };
    if (input.title !== undefined) {
      assertText(input.title, "El título de la tarea");
      payload.title = input.title.trim();
    }
    if (input.description !== undefined) payload.description = input.description.trim();
    if (input.status !== undefined) {
      payload.status = input.status;
      payload.completed = input.status === "done";
    }
    if (input.priority !== undefined) payload.priority = input.priority;
    if (input.dueDate !== undefined) payload.due_date = input.dueDate || null;
    if (input.startDate !== undefined) payload.start_date = input.startDate || null;
    if (input.estimateMinutes !== undefined) payload.estimate_minutes = Math.max(0, input.estimateMinutes);
    if (input.assigneeId !== undefined) payload.assignee_id = input.assigneeId || null;
    const { error } = await this.client.from("tasks").update(payload).eq("id", taskId);
    if (error) throw asError(error, "No pudimos actualizar la tarea.");
    const next = await this.getSnapshot();
    const task = next?.tasks.find((item) => item.id === taskId);
    if (!task) throw new Error("No pudimos recuperar la tarea actualizada.");
    return task;
  }

  async moveTask(taskId: string, status: TaskStatus): Promise<TaskSummary> {
    return this.updateTask(taskId, { status });
  }

  async deleteTask(taskId: string): Promise<void> {
    const { error } = await this.client.from("tasks").delete().eq("id", taskId);
    if (error) throw asError(error, "No pudimos eliminar la tarea.");
  }

  async startTimer(taskId: string): Promise<void> {
    const user = await this.requireUser();
    const snapshot = await this.getSnapshot();
    if (!snapshot) throw new Error("No hay organización activa.");
    const task = snapshot.tasks.find((item) => item.id === taskId);
    if (!task) throw new Error("No se encontró la tarea.");
    const { error } = await this.client.from("active_timers").upsert({
      user_id: user.id,
      organization_id: snapshot.activeOrganization.id,
      task_id: taskId,
      started_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) throw asError(error, "No pudimos iniciar el timer.");
  }

  async stopTimer(): Promise<TimeEntrySummary> {
    const user = await this.requireUser();
    const { data: timer, error: timerError } = await this.client
      .from("active_timers")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (timerError) throw asError(timerError, "No pudimos leer el timer.");
    if (!timer) throw new Error("No hay un timer activo.");

    const { data: task, error: taskError } = await this.client
      .from("tasks")
      .select("id,project_id,title")
      .eq("id", timer.task_id)
      .single();
    if (taskError) throw asError(taskError, "No pudimos leer la tarea del timer.");

    const durationMinutes = Math.max(1, Math.round((Date.now() - new Date(timer.started_at).getTime()) / 60_000));
    const { data: entry, error: entryError } = await this.client.from("time_entries").insert({
      organization_id: timer.organization_id,
      project_id: task.project_id,
      task_id: task.id,
      user_id: user.id,
      work_date: todayIsoDate(),
      duration_minutes: durationMinutes,
      note: `Timer: ${task.title}`,
      source: "timer",
    }).select("*").single();
    if (entryError) throw asError(entryError, "No pudimos guardar el tiempo.");

    const { error: deleteError } = await this.client.from("active_timers").delete().eq("user_id", user.id);
    if (deleteError) throw asError(deleteError, "El tiempo se guardó, pero no pudimos cerrar el timer.");

    return {
      id: entry.id,
      projectId: entry.project_id,
      taskId: entry.task_id || undefined,
      workDate: entry.work_date,
      durationMinutes: Number(entry.duration_minutes),
      note: entry.note || "",
      source: "timer",
    };
  }

  async createTimeEntry(input: CreateTimeEntryInput): Promise<TimeEntrySummary> {
    if (input.durationMinutes <= 0) throw new Error("La duración debe ser mayor a cero.");
    const user = await this.requireUser();
    const snapshot = await this.getSnapshot();
    if (!snapshot) throw new Error("No hay organización activa.");
    const { data, error } = await this.client.from("time_entries").insert({
      organization_id: snapshot.activeOrganization.id,
      project_id: input.projectId,
      task_id: input.taskId || null,
      user_id: user.id,
      work_date: input.workDate,
      duration_minutes: input.durationMinutes,
      note: input.note?.trim() || "",
      source: "manual",
    }).select("*").single();
    if (error) throw asError(error, "No pudimos registrar el tiempo.");
    return {
      id: data.id,
      projectId: data.project_id,
      taskId: data.task_id || undefined,
      workDate: data.work_date,
      durationMinutes: Number(data.duration_minutes),
      note: data.note || "",
      source: "manual",
    };
  }

  async markAllNotificationsRead(): Promise<void> {
    // Las alertas cloud se derivan del estado actual; no se almacenan como datos falsos.
  }

  async exportSnapshot(): Promise<string> {
    const snapshot = await this.getSnapshot();
    if (!snapshot) throw new Error("No hay workspace para exportar.");
    return JSON.stringify({
      format: "yetly-cloud-export",
      version: 1,
      exportedAt: new Date().toISOString(),
      snapshot,
    }, null, 2);
  }

  async importSnapshot(serialized: string): Promise<ImportResult> {
    let parsed: any;
    try {
      parsed = JSON.parse(serialized);
    } catch {
      throw new Error("El archivo no contiene JSON válido.");
    }
    const snapshot = parsed?.snapshot as WorkspaceSnapshot | undefined;
    if (!snapshot || !Array.isArray(snapshot.projects) || !Array.isArray(snapshot.tasks)) {
      throw new Error("El respaldo no corresponde a una exportación cloud de Yetly.");
    }

    const projectMap = new Map<string, string>();
    let projects = 0;
    let tasks = 0;
    let timeEntries = 0;

    for (const project of snapshot.projects) {
      await this.createProject({
        name: project.name,
        code: project.code,
        teamName: project.teamName,
        targetDate: project.targetDate === "Sin fecha objetivo" ? undefined : project.targetDate,
        status: project.status,
      });
      const next = await this.getSnapshot();
      const created = next?.projects.find((item) => item.code === project.code || item.name === project.name);
      if (created) {
        projectMap.set(project.id, created.id);
        projects += 1;
      }
    }

    const taskMap = new Map<string, string>();
    for (const task of snapshot.tasks) {
      const projectId = projectMap.get(task.projectId);
      if (!projectId) continue;
      const created = await this.createTask({
        projectId,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        startDate: task.startDate,
        estimateMinutes: task.estimateMinutes,
      });
      taskMap.set(task.id, created.id);
      tasks += 1;
    }

    for (const entry of snapshot.timeEntries ?? []) {
      const projectId = projectMap.get(entry.projectId);
      if (!projectId) continue;
      await this.createTimeEntry({
        projectId,
        taskId: entry.taskId ? taskMap.get(entry.taskId) : undefined,
        workDate: entry.workDate,
        durationMinutes: entry.durationMinutes,
        note: entry.note,
      });
      timeEntries += 1;
    }

    return { projects, tasks, timeEntries };
  }

  async resetWorkspace(): Promise<void> {
    throw new Error("Por seguridad, Yetly no borra una organización cloud completa desde el navegador. Desconecta Supabase o elimina los datos desde tu proyecto Supabase.");
  }

  subscribe(onChange: () => void): () => void {
    const tables = ["projects", "tasks", "time_entries", "teams", "team_members", "organization_members", "profiles"];
    let channel: RealtimeChannel = this.client.channel(`yetly-workspace-${crypto.randomUUID()}`);
    for (const table of tables) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => onChange(),
      );
    }
    channel.subscribe();
    return () => {
      void this.client.removeChannel(channel);
    };
  }
}

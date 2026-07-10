-- Yetly Cloud schema v1.5
-- Ejecutar completo en Supabase Dashboard > SQL Editor.
-- No requiere service_role en Yetly. La app usa únicamente Project URL + publishable key.

create extension if not exists pgcrypto;

create table if not exists public.yetly_schema_meta (
  id smallint primary key default 1 check (id = 1),
  version integer not null,
  installed_at timestamptz not null default now()
);
insert into public.yetly_schema_meta (id, version)
values (1, 15)
on conflict (id) do update set version = excluded.version;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Usuario',
  role_title text not null default 'Member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) >= 2),
  color text not null default '#6d5dfc',
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member','viewer')),
  joined_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) >= 2),
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('lead','member')),
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  code text not null,
  name text not null check (char_length(trim(name)) >= 2),
  status text not null default 'active' check (status in ('planned','active','on_hold','completed')),
  target_date date,
  accent text not null default '#6d5dfc',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(trim(title)) >= 2),
  description text not null default '',
  status text not null default 'todo' check (status in ('backlog','todo','in_progress','review','done')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  due_date date,
  start_date date,
  estimate_minutes integer not null default 0 check (estimate_minutes >= 0),
  assignee_id uuid references auth.users(id) on delete set null,
  labels text[] not null default '{}',
  blocked_reason text,
  completed boolean not null default false,
  mode text not null default 'standard' check (mode in ('standard','checklist','message')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks
  add column if not exists mode text not null default 'standard';
do $$
begin
  alter table public.tasks add constraint tasks_mode_check check (mode in ('standard','checklist','message'));
exception when duplicate_object then null;
end $$;

create table if not exists public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  text text not null check (char_length(trim(text)) >= 1),
  completed boolean not null default false,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) >= 1),
  created_at timestamptz not null default now()
);

create table if not exists public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  content_type text not null default 'application/octet-stream',
  size_bytes bigint not null check (size_bytes >= 0),
  version integer not null default 1 check (version > 0),
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  uploaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.task_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  detail text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.team_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) >= 1),
  created_at timestamptz not null default now()
);

create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  type text not null check (type in ('general','channel','direct')),
  name text not null check (char_length(trim(name)) >= 1),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, type, name)
);

create table if not exists public.chat_participants (
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) >= 1),
  created_at timestamptz not null default now()
);

create table if not exists public.workflow_node_positions (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  x double precision not null default 0,
  y double precision not null default 0,
  updated_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  primary key (project_id, task_id)
);

create table if not exists public.workflow_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  source_task_id uuid not null references public.tasks(id) on delete cascade,
  target_task_id uuid not null references public.tasks(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (source_task_id <> target_task_id),
  unique (project_id, source_task_id, target_task_id)
);

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  work_date date not null,
  duration_minutes integer not null check (duration_minutes > 0),
  note text not null default '',
  source text not null default 'manual' check (source in ('timer','manual')),
  created_at timestamptz not null default now()
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  object_label text not null,
  occurred_at timestamptz not null default now()
);

create table if not exists public.active_timers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  started_at timestamptz not null default now()
);

create index if not exists idx_org_members_user on public.organization_members(user_id);
create index if not exists idx_teams_org on public.teams(organization_id);
create index if not exists idx_team_members_user on public.team_members(user_id);
create index if not exists idx_projects_org on public.projects(organization_id);
create index if not exists idx_tasks_org on public.tasks(organization_id);
create index if not exists idx_tasks_project on public.tasks(project_id);
create index if not exists idx_tasks_assignee on public.tasks(assignee_id);
create index if not exists idx_task_checklist_task on public.task_checklist_items(task_id);
create index if not exists idx_task_messages_task on public.task_messages(task_id, created_at);
create index if not exists idx_task_attachments_task on public.task_attachments(task_id, uploaded_at);
create index if not exists idx_task_events_task on public.task_events(task_id, created_at);
create index if not exists idx_team_messages_org on public.team_messages(organization_id, created_at);
create index if not exists idx_chat_conversations_org on public.chat_conversations(organization_id, created_at);
create index if not exists idx_chat_participants_user on public.chat_participants(user_id);
create index if not exists idx_chat_messages_conversation on public.chat_messages(conversation_id, created_at);
create index if not exists idx_workflow_positions_project on public.workflow_node_positions(project_id);
create index if not exists idx_workflow_connections_project on public.workflow_connections(project_id, created_at);
create index if not exists idx_time_entries_org on public.time_entries(organization_id);
create index if not exists idx_time_entries_user on public.time_entries(user_id);
create index if not exists idx_activities_org on public.activities(organization_id);

create or replace function public.yetly_is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_org
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.yetly_is_org_admin(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_org
      and m.user_id = auth.uid()
      and m.role in ('owner','admin')
  );
$$;

create or replace function public.yetly_share_org_with(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members mine
    join public.organization_members theirs
      on theirs.organization_id = mine.organization_id
    where mine.user_id = auth.uid()
      and theirs.user_id = target_user
  );
$$;

create or replace function public.yetly_user_in_org(target_org uuid, target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_org
      and m.user_id = target_user
  );
$$;

create or replace function public.yetly_upsert_my_profile(
  user_name text,
  role_name text default 'Member'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.';
  end if;
  insert into public.profiles (id, full_name, role_title)
  values (
    auth.uid(),
    coalesce(nullif(trim(user_name), ''), 'Usuario'),
    coalesce(nullif(trim(role_name), ''), 'Member')
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        role_title = excluded.role_title,
        updated_at = now();
end;
$$;

create or replace function public.yetly_create_organization(
  org_name text,
  user_name text,
  role_name text default 'Owner'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org uuid;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.';
  end if;
  if char_length(trim(org_name)) < 2 then
    raise exception 'El nombre de la organización es demasiado corto.';
  end if;

  perform public.yetly_upsert_my_profile(user_name, role_name);

  insert into public.organizations (name, created_by)
  values (trim(org_name), auth.uid())
  returning id into new_org;

  insert into public.organization_members (organization_id, user_id, role)
  values (new_org, auth.uid(), 'owner');

  insert into public.chat_conversations (organization_id, type, name, created_by)
  values (new_org, 'general', 'general', auth.uid())
  on conflict (organization_id, type, name) do nothing;

  insert into public.chat_participants (conversation_id, organization_id, user_id)
  select id, organization_id, auth.uid()
  from public.chat_conversations
  where organization_id = new_org and type = 'general' and name = 'general'
  on conflict (conversation_id, user_id) do nothing;

  return new_org;
end;
$$;

create or replace function public.yetly_join_organization(
  invite text,
  user_name text,
  role_name text default 'Member'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_org uuid;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.';
  end if;

  select id into target_org
  from public.organizations
  where upper(invite_code) = upper(trim(invite))
  limit 1;

  if target_org is null then
    raise exception 'Código de invitación inválido.';
  end if;

  perform public.yetly_upsert_my_profile(user_name, role_name);

  insert into public.organization_members (organization_id, user_id, role)
  values (target_org, auth.uid(), 'member')
  on conflict (organization_id, user_id) do nothing;

  insert into public.chat_conversations (organization_id, type, name, created_by)
  values (target_org, 'general', 'general', auth.uid())
  on conflict (organization_id, type, name) do nothing;

  insert into public.chat_participants (conversation_id, organization_id, user_id)
  select id, organization_id, auth.uid()
  from public.chat_conversations
  where organization_id = target_org and type = 'general' and name = 'general'
  on conflict (conversation_id, user_id) do nothing;

  return target_org;
end;
$$;

create or replace function public.yetly_rotate_invite_code(target_org uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_code text;
begin
  if not public.yetly_is_org_admin(target_org) then
    raise exception 'No tienes permisos para renovar el código.';
  end if;

  next_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  update public.organizations
  set invite_code = next_code
  where id = target_org;

  return next_code;
end;
$$;

insert into public.chat_conversations (organization_id, type, name, created_by)
select org.id, 'general', 'general', org.created_by
from public.organizations org
on conflict (organization_id, type, name) do nothing;

insert into public.chat_participants (conversation_id, organization_id, user_id)
select chat.id, member.organization_id, member.user_id
from public.chat_conversations chat
join public.organization_members member on member.organization_id = chat.organization_id
where chat.type = 'general' and chat.name = 'general'
on conflict (conversation_id, user_id) do nothing;

insert into public.chat_messages (id, conversation_id, organization_id, author_id, body, created_at)
select old.id, chat.id, old.organization_id, old.author_id, old.body, old.created_at
from public.team_messages old
join public.chat_conversations chat
  on chat.organization_id = old.organization_id
 and chat.type = 'general'
 and chat.name = 'general'
on conflict (id) do nothing;

alter table public.yetly_schema_meta enable row level security;
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_checklist_items enable row level security;
alter table public.task_messages enable row level security;
alter table public.task_attachments enable row level security;
alter table public.task_events enable row level security;
alter table public.team_messages enable row level security;
alter table public.chat_conversations enable row level security;
alter table public.chat_participants enable row level security;
alter table public.chat_messages enable row level security;
alter table public.workflow_node_positions enable row level security;
alter table public.workflow_connections enable row level security;
alter table public.time_entries enable row level security;
alter table public.activities enable row level security;
alter table public.active_timers enable row level security;

drop policy if exists "schema version readable" on public.yetly_schema_meta;
create policy "schema version readable"
on public.yetly_schema_meta for select
to anon, authenticated
using (true);

drop policy if exists "profiles visible to shared organizations" on public.profiles;
create policy "profiles visible to shared organizations"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.yetly_share_org_with(id));

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "members read organizations" on public.organizations;
create policy "members read organizations"
on public.organizations for select
to authenticated
using (public.yetly_is_org_member(id));

drop policy if exists "admins update organizations" on public.organizations;
create policy "admins update organizations"
on public.organizations for update
to authenticated
using (public.yetly_is_org_admin(id))
with check (public.yetly_is_org_admin(id));

drop policy if exists "members read memberships" on public.organization_members;
create policy "members read memberships"
on public.organization_members for select
to authenticated
using (public.yetly_is_org_member(organization_id));

drop policy if exists "admins update memberships" on public.organization_members;
create policy "admins update memberships"
on public.organization_members for update
to authenticated
using (public.yetly_is_org_admin(organization_id))
with check (public.yetly_is_org_admin(organization_id));

drop policy if exists "admins delete memberships" on public.organization_members;
create policy "admins delete memberships"
on public.organization_members for delete
to authenticated
using (
  public.yetly_is_org_admin(organization_id)
  or user_id = auth.uid()
);

drop policy if exists "members read teams" on public.teams;
create policy "members read teams"
on public.teams for select
to authenticated
using (public.yetly_is_org_member(organization_id));

drop policy if exists "members create teams" on public.teams;
create policy "members create teams"
on public.teams for insert
to authenticated
with check (public.yetly_is_org_member(organization_id));

drop policy if exists "members update teams" on public.teams;
create policy "members update teams"
on public.teams for update
to authenticated
using (public.yetly_is_org_member(organization_id))
with check (public.yetly_is_org_member(organization_id));

drop policy if exists "members delete teams" on public.teams;
create policy "members delete teams"
on public.teams for delete
to authenticated
using (public.yetly_is_org_member(organization_id));

drop policy if exists "members read team memberships" on public.team_members;
create policy "members read team memberships"
on public.team_members for select
to authenticated
using (
  exists (
    select 1 from public.teams t
    where t.id = team_id
      and public.yetly_is_org_member(t.organization_id)
  )
);

drop policy if exists "members add team memberships" on public.team_members;
create policy "members add team memberships"
on public.team_members for insert
to authenticated
with check (
  exists (
    select 1
    from public.teams t
    join public.organization_members om
      on om.organization_id = t.organization_id
     and om.user_id = team_members.user_id
    where t.id = team_id
      and public.yetly_is_org_member(t.organization_id)
  )
);

drop policy if exists "members delete team memberships" on public.team_members;
create policy "members delete team memberships"
on public.team_members for delete
to authenticated
using (
  exists (
    select 1 from public.teams t
    where t.id = team_id
      and public.yetly_is_org_member(t.organization_id)
  )
);

drop policy if exists "members read projects" on public.projects;
create policy "members read projects"
on public.projects for select
to authenticated
using (public.yetly_is_org_member(organization_id));

drop policy if exists "members create projects" on public.projects;
create policy "members create projects"
on public.projects for insert
to authenticated
with check (
  public.yetly_is_org_member(organization_id)
  and created_by = auth.uid()
);

drop policy if exists "members update projects" on public.projects;
create policy "members update projects"
on public.projects for update
to authenticated
using (public.yetly_is_org_member(organization_id))
with check (public.yetly_is_org_member(organization_id));

drop policy if exists "members delete projects" on public.projects;
create policy "members delete projects"
on public.projects for delete
to authenticated
using (public.yetly_is_org_member(organization_id));

drop policy if exists "members read tasks" on public.tasks;
create policy "members read tasks"
on public.tasks for select
to authenticated
using (public.yetly_is_org_member(organization_id));

drop policy if exists "members create tasks" on public.tasks;
create policy "members create tasks"
on public.tasks for insert
to authenticated
with check (
  public.yetly_is_org_member(organization_id)
  and created_by = auth.uid()
);

drop policy if exists "members update tasks" on public.tasks;
create policy "members update tasks"
on public.tasks for update
to authenticated
using (created_by = auth.uid() or public.yetly_is_org_admin(organization_id))
with check (created_by = auth.uid() or public.yetly_is_org_admin(organization_id));

drop policy if exists "members delete tasks" on public.tasks;
create policy "members delete tasks"
on public.tasks for delete
to authenticated
using (created_by = auth.uid() or public.yetly_is_org_admin(organization_id));

drop policy if exists "members read checklist" on public.task_checklist_items;
create policy "members read checklist" on public.task_checklist_items for select to authenticated
using (public.yetly_is_org_member(organization_id));
drop policy if exists "members create checklist" on public.task_checklist_items;
create policy "members create checklist" on public.task_checklist_items for insert to authenticated
with check (public.yetly_is_org_member(organization_id) and created_by = auth.uid());
drop policy if exists "members update checklist" on public.task_checklist_items;
create policy "members update checklist" on public.task_checklist_items for update to authenticated
using (public.yetly_is_org_member(organization_id)) with check (public.yetly_is_org_member(organization_id));
drop policy if exists "members delete checklist" on public.task_checklist_items;
create policy "members delete checklist" on public.task_checklist_items for delete to authenticated
using (created_by = auth.uid() or public.yetly_is_org_admin(organization_id));

drop policy if exists "members read task messages" on public.task_messages;
create policy "members read task messages" on public.task_messages for select to authenticated
using (public.yetly_is_org_member(organization_id));
drop policy if exists "members create task messages" on public.task_messages;
create policy "members create task messages" on public.task_messages for insert to authenticated
with check (public.yetly_is_org_member(organization_id) and author_id = auth.uid());

drop policy if exists "members read task attachments" on public.task_attachments;
create policy "members read task attachments" on public.task_attachments for select to authenticated
using (public.yetly_is_org_member(organization_id));
drop policy if exists "members create task attachments" on public.task_attachments;
create policy "members create task attachments" on public.task_attachments for insert to authenticated
with check (public.yetly_is_org_member(organization_id) and uploaded_by = auth.uid());
drop policy if exists "uploaders update task attachments" on public.task_attachments;
create policy "uploaders update task attachments" on public.task_attachments for update to authenticated
using (uploaded_by = auth.uid() or public.yetly_is_org_admin(organization_id))
with check (uploaded_by = auth.uid() or public.yetly_is_org_admin(organization_id));

drop policy if exists "members read task events" on public.task_events;
create policy "members read task events" on public.task_events for select to authenticated
using (public.yetly_is_org_member(organization_id));
drop policy if exists "members create task events" on public.task_events;
create policy "members create task events" on public.task_events for insert to authenticated
with check (public.yetly_is_org_member(organization_id) and actor_id = auth.uid());

drop policy if exists "members read team messages" on public.team_messages;
create policy "members read team messages" on public.team_messages for select to authenticated
using (public.yetly_is_org_member(organization_id));
drop policy if exists "members create team messages" on public.team_messages;
create policy "members create team messages" on public.team_messages for insert to authenticated
with check (public.yetly_is_org_member(organization_id) and author_id = auth.uid());

drop policy if exists "members read chat conversations" on public.chat_conversations;
create policy "members read chat conversations" on public.chat_conversations for select to authenticated
using (
  public.yetly_is_org_member(organization_id)
  and (
    type <> 'direct'
    or exists (
      select 1
      from public.chat_participants p
      where p.conversation_id = chat_conversations.id
        and p.user_id = auth.uid()
    )
  )
);
drop policy if exists "members create chat conversations" on public.chat_conversations;
create policy "members create chat conversations" on public.chat_conversations for insert to authenticated
with check (public.yetly_is_org_member(organization_id) and (created_by = auth.uid() or created_by is null));

drop policy if exists "members read chat participants" on public.chat_participants;
create policy "members read chat participants" on public.chat_participants for select to authenticated
using (public.yetly_is_org_member(organization_id));
drop policy if exists "members create chat participants" on public.chat_participants;
create policy "members create chat participants" on public.chat_participants for insert to authenticated
with check (public.yetly_is_org_member(organization_id) and public.yetly_user_in_org(organization_id, user_id));

drop policy if exists "members read chat messages" on public.chat_messages;
create policy "members read chat messages" on public.chat_messages for select to authenticated
using (
  public.yetly_is_org_member(organization_id)
  and exists (
    select 1
    from public.chat_conversations c
    where c.id = conversation_id
      and c.organization_id = organization_id
      and (
        c.type <> 'direct'
        or exists (
          select 1
          from public.chat_participants p
          where p.conversation_id = c.id
            and p.user_id = auth.uid()
        )
      )
  )
);
drop policy if exists "members create chat messages" on public.chat_messages;
create policy "members create chat messages" on public.chat_messages for insert to authenticated
with check (
  public.yetly_is_org_member(organization_id)
  and author_id = auth.uid()
  and exists (
    select 1
    from public.chat_conversations c
    where c.id = conversation_id
      and c.organization_id = organization_id
      and (
        c.type <> 'direct'
        or exists (
          select 1
          from public.chat_participants p
          where p.conversation_id = c.id
            and p.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists "members read workflow positions" on public.workflow_node_positions;
create policy "members read workflow positions" on public.workflow_node_positions for select to authenticated
using (public.yetly_is_org_member(organization_id));
drop policy if exists "members create workflow positions" on public.workflow_node_positions;
create policy "members create workflow positions" on public.workflow_node_positions for insert to authenticated
with check (
  public.yetly_is_org_member(organization_id)
  and updated_by = auth.uid()
  and exists (
    select 1 from public.tasks t
    where t.id = workflow_node_positions.task_id
      and t.project_id = workflow_node_positions.project_id
      and t.organization_id = workflow_node_positions.organization_id
  )
);
drop policy if exists "members update workflow positions" on public.workflow_node_positions;
create policy "members update workflow positions" on public.workflow_node_positions for update to authenticated
using (public.yetly_is_org_member(organization_id))
with check (
  public.yetly_is_org_member(organization_id)
  and updated_by = auth.uid()
  and exists (
    select 1 from public.tasks t
    where t.id = workflow_node_positions.task_id
      and t.project_id = workflow_node_positions.project_id
      and t.organization_id = workflow_node_positions.organization_id
  )
);

drop policy if exists "members read workflow connections" on public.workflow_connections;
create policy "members read workflow connections" on public.workflow_connections for select to authenticated
using (public.yetly_is_org_member(organization_id));
drop policy if exists "members create workflow connections" on public.workflow_connections;
create policy "members create workflow connections" on public.workflow_connections for insert to authenticated
with check (
  public.yetly_is_org_member(organization_id)
  and created_by = auth.uid()
  and exists (
    select 1 from public.tasks source
    where source.id = workflow_connections.source_task_id
      and source.project_id = workflow_connections.project_id
      and source.organization_id = workflow_connections.organization_id
  )
  and exists (
    select 1 from public.tasks target
    where target.id = workflow_connections.target_task_id
      and target.project_id = workflow_connections.project_id
      and target.organization_id = workflow_connections.organization_id
  )
);
drop policy if exists "members delete workflow connections" on public.workflow_connections;
create policy "members delete workflow connections" on public.workflow_connections for delete to authenticated
using (public.yetly_is_org_member(organization_id));

drop policy if exists "members read time entries" on public.time_entries;
create policy "members read time entries"
on public.time_entries for select
to authenticated
using (public.yetly_is_org_member(organization_id));

drop policy if exists "users create own time entries" on public.time_entries;
create policy "users create own time entries"
on public.time_entries for insert
to authenticated
with check (
  public.yetly_is_org_member(organization_id)
  and user_id = auth.uid()
);

drop policy if exists "users update own time entries" on public.time_entries;
create policy "users update own time entries"
on public.time_entries for update
to authenticated
using (user_id = auth.uid() or public.yetly_is_org_admin(organization_id))
with check (user_id = auth.uid() or public.yetly_is_org_admin(organization_id));

drop policy if exists "users delete own time entries" on public.time_entries;
create policy "users delete own time entries"
on public.time_entries for delete
to authenticated
using (user_id = auth.uid() or public.yetly_is_org_admin(organization_id));

drop policy if exists "members read activities" on public.activities;
create policy "members read activities"
on public.activities for select
to authenticated
using (public.yetly_is_org_member(organization_id));

drop policy if exists "members create own activities" on public.activities;
create policy "members create own activities"
on public.activities for insert
to authenticated
with check (
  public.yetly_is_org_member(organization_id)
  and actor_id = auth.uid()
);

drop policy if exists "users read own timer" on public.active_timers;
create policy "users read own timer"
on public.active_timers for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "users create own timer" on public.active_timers;
create policy "users create own timer"
on public.active_timers for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.yetly_is_org_member(organization_id)
);

drop policy if exists "users update own timer" on public.active_timers;
create policy "users update own timer"
on public.active_timers for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "users delete own timer" on public.active_timers;
create policy "users delete own timer"
on public.active_timers for delete
to authenticated
using (user_id = auth.uid());

revoke all on public.yetly_schema_meta, public.profiles, public.organizations,
  public.organization_members, public.teams, public.team_members, public.projects,
  public.tasks, public.task_checklist_items, public.task_messages, public.task_attachments,
  public.task_events, public.team_messages, public.chat_conversations, public.chat_participants,
  public.chat_messages, public.workflow_node_positions, public.workflow_connections,
  public.time_entries, public.activities, public.active_timers
from anon, authenticated;

grant select on public.yetly_schema_meta to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, update on public.organizations to authenticated;
grant select, update, delete on public.organization_members to authenticated;
grant select, insert, update, delete on public.teams to authenticated;
grant select, insert, update, delete on public.team_members to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.task_checklist_items to authenticated;
grant select, insert on public.task_messages to authenticated;
grant select, insert, update on public.task_attachments to authenticated;
grant select, insert on public.task_events to authenticated;
grant select, insert on public.team_messages to authenticated;
grant select, insert on public.chat_conversations to authenticated;
grant select, insert on public.chat_participants to authenticated;
grant select, insert on public.chat_messages to authenticated;
grant select, insert, update on public.workflow_node_positions to authenticated;
grant select, insert, delete on public.workflow_connections to authenticated;
grant select, insert, update, delete on public.time_entries to authenticated;
grant select, insert on public.activities to authenticated;
grant select, insert, update, delete on public.active_timers to authenticated;

grant execute on function public.yetly_is_org_member(uuid) to authenticated;
grant execute on function public.yetly_is_org_admin(uuid) to authenticated;
grant execute on function public.yetly_share_org_with(uuid) to authenticated;
grant execute on function public.yetly_user_in_org(uuid, uuid) to authenticated;
grant execute on function public.yetly_upsert_my_profile(text, text) to authenticated;
grant execute on function public.yetly_create_organization(text, text, text) to authenticated;
grant execute on function public.yetly_join_organization(text, text, text) to authenticated;
grant execute on function public.yetly_rotate_invite_code(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('yetly-task-files', 'yetly-task-files', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists "org members read yetly task files" on storage.objects;
create policy "org members read yetly task files" on storage.objects for select to authenticated
using (
  bucket_id = 'yetly-task-files'
  and public.yetly_is_org_member((storage.foldername(name))[1]::uuid)
);
drop policy if exists "org members upload yetly task files" on storage.objects;
create policy "org members upload yetly task files" on storage.objects for insert to authenticated
with check (
  bucket_id = 'yetly-task-files'
  and public.yetly_is_org_member((storage.foldername(name))[1]::uuid)
);
drop policy if exists "file owners update yetly task files" on storage.objects;
create policy "file owners update yetly task files" on storage.objects for update to authenticated
using (
  bucket_id = 'yetly-task-files'
  and (owner_id = auth.uid()::text or public.yetly_is_org_admin((storage.foldername(name))[1]::uuid))
)
with check (
  bucket_id = 'yetly-task-files'
  and (owner_id = auth.uid()::text or public.yetly_is_org_admin((storage.foldername(name))[1]::uuid))
);
drop policy if exists "file owners delete yetly task files" on storage.objects;
create policy "file owners delete yetly task files" on storage.objects for delete to authenticated
using (
  bucket_id = 'yetly-task-files'
  and (owner_id = auth.uid()::text or public.yetly_is_org_admin((storage.foldername(name))[1]::uuid))
);

do $$
begin
  alter publication supabase_realtime add table public.projects;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.tasks;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.time_entries;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.teams;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.team_members;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.organization_members;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.task_checklist_items;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.task_messages;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.task_attachments;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.task_events;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.team_messages;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.chat_conversations;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.chat_participants;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.workflow_node_positions;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.workflow_connections;
exception when duplicate_object then null;
end $$;

-- Fin. Vuelve a Yetly y pulsa "Verificar instalación".

-- Yetly Cloud schema v1.2
-- Ejecutar completo en Supabase Dashboard > SQL Editor.
-- No requiere service_role en Yetly. La app usa únicamente Project URL + publishable key.

create extension if not exists pgcrypto;

create table if not exists public.yetly_schema_meta (
  id smallint primary key default 1 check (id = 1),
  version integer not null,
  installed_at timestamptz not null default now()
);
insert into public.yetly_schema_meta (id, version)
values (1, 12)
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
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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

alter table public.yetly_schema_meta enable row level security;
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
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
using (public.yetly_is_org_member(organization_id))
with check (public.yetly_is_org_member(organization_id));

drop policy if exists "members delete tasks" on public.tasks;
create policy "members delete tasks"
on public.tasks for delete
to authenticated
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
  public.tasks, public.time_entries, public.activities, public.active_timers
from anon, authenticated;

grant select on public.yetly_schema_meta to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, update on public.organizations to authenticated;
grant select, update, delete on public.organization_members to authenticated;
grant select, insert, update, delete on public.teams to authenticated;
grant select, insert, update, delete on public.team_members to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.time_entries to authenticated;
grant select, insert on public.activities to authenticated;
grant select, insert, update, delete on public.active_timers to authenticated;

grant execute on function public.yetly_is_org_member(uuid) to authenticated;
grant execute on function public.yetly_is_org_admin(uuid) to authenticated;
grant execute on function public.yetly_share_org_with(uuid) to authenticated;
grant execute on function public.yetly_upsert_my_profile(text, text) to authenticated;
grant execute on function public.yetly_create_organization(text, text, text) to authenticated;
grant execute on function public.yetly_join_organization(text, text, text) to authenticated;
grant execute on function public.yetly_rotate_invite_code(uuid) to authenticated;

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

-- Fin. Vuelve a Yetly y pulsa "Verificar instalación".

-- Yetly Control Plane. Ejecutar únicamente en el proyecto central administrado.
create extension if not exists pgcrypto;

create table if not exists public.managed_oauth_sessions (
  id uuid primary key default gen_random_uuid(),
  state_hash text not null unique,
  encrypted_code_verifier text not null,
  return_url text not null,
  workspace_name text not null default 'Mi espacio',
  expires_at timestamptz not null default now() + interval '15 minutes',
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.managed_supabase_connections (
  id uuid primary key default gen_random_uuid(),
  encrypted_tokens text not null,
  token_expires_at timestamptz,
  project_ref text,
  organization_id text,
  schema_version integer,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.managed_setup_tickets (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.managed_supabase_connections(id) on delete cascade,
  ticket_hash text not null unique,
  expires_at timestamptz not null default now() + interval '24 hours',
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.managed_provisioning_jobs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.managed_supabase_connections(id) on delete cascade,
  installation_id uuid not null default gen_random_uuid(),
  status text not null default 'queued' check (status in ('queued','running','completed','failed','needs_reauthorization')),
  phase text not null default 'project',
  progress integer not null default 0 check (progress between 0 and 100),
  message text not null default 'Preparando instalación',
  recoverable boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error_code text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists managed_jobs_connection_idx on public.managed_provisioning_jobs(connection_id, created_at desc);
create index if not exists managed_tickets_connection_idx on public.managed_setup_tickets(connection_id);

alter table public.managed_oauth_sessions enable row level security;
alter table public.managed_supabase_connections enable row level security;
alter table public.managed_setup_tickets enable row level security;
alter table public.managed_provisioning_jobs enable row level security;

-- Sin políticas intencionalmente: solo la Edge Function con service_role accede.
revoke all on public.managed_oauth_sessions, public.managed_supabase_connections,
  public.managed_setup_tickets, public.managed_provisioning_jobs from anon, authenticated;


-- Auth 1.0 migration for Fengbian.
-- Run this in Supabase SQL Editor before deploying the Auth 1.0 backend.

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_users_username_check check (username ~ '^[A-Za-z0-9_]{4,20}$'),
  constraint app_users_display_name_check check (char_length(display_name) between 1 and 20)
);

create index if not exists app_users_username_idx
  on public.app_users (username);

alter table public.training_records
  add column if not exists app_user_id uuid references public.app_users(id) on delete set null;

alter table public.team_members
  add column if not exists app_user_id uuid references public.app_users(id) on delete set null;

alter table public.team_tasks
  add column if not exists created_by_app_user_id uuid references public.app_users(id) on delete set null;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.team_members'::regclass
      and conname = 'team_members_status_check'
  ) then
    alter table public.team_members drop constraint team_members_status_check;
  end if;

  alter table public.team_members
    add constraint team_members_status_check check (status in ('active', 'left', 'removed'));
end $$;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.team_members'::regclass
      and conname = 'team_members_role_check'
  ) then
    alter table public.team_members drop constraint team_members_role_check;
  end if;

  alter table public.team_members
    add constraint team_members_role_check check (role in ('captain', 'member', 'owner'));
end $$;

create index if not exists training_records_app_user_created_idx
  on public.training_records (app_user_id, created_at desc);

create index if not exists team_members_app_user_status_idx
  on public.team_members (app_user_id, status);

create index if not exists team_tasks_created_by_app_user_idx
  on public.team_tasks (created_by_app_user_id);

-- For Auth 1.0, official team identity is app_user_id.
-- If you keep old test rows with app_user_id null, this partial unique index will not affect them.
create unique index if not exists team_members_team_app_user_unique
  on public.team_members (team_code, app_user_id)
  where app_user_id is not null;

-- Optional cleanup path.
-- Dangerous operation: this clears test data. Execute only if the project has not officially launched.
-- truncate table public.training_records restart identity cascade;
-- truncate table public.team_members restart identity cascade;
-- truncate table public.team_tasks restart identity cascade;
-- truncate table public.teams restart identity cascade;
-- truncate table public.app_users restart identity cascade;

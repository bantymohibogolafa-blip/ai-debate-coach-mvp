-- Team Task 4.0 migration
-- Adds locked task metadata, selected-member assignments, and manual end metadata.
-- Safe migration: does not clear existing data.

alter table public.team_tasks
  add column if not exists ai_side text,
  add column if not exists assignment_type text not null default 'all',
  add column if not exists ended_at timestamptz,
  add column if not exists ended_by uuid references public.app_users(id) on delete set null;

update public.team_tasks
set
  assignment_type = coalesce(nullif(assignment_type, ''), 'all'),
  ai_side = coalesce(
    ai_side,
    case
      when user_side = 'affirmative' then 'negative'
      when user_side = 'negative' then 'affirmative'
      else null
    end
  );

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.team_tasks'::regclass
      and conname = 'team_tasks_status_check'
  ) then
    alter table public.team_tasks drop constraint team_tasks_status_check;
  end if;

  alter table public.team_tasks
    add constraint team_tasks_status_check
    check (status in ('active', 'closed', 'ended', 'expired', 'archived'));
end $$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.team_tasks'::regclass
      and conname = 'team_tasks_assignment_type_check'
  ) then
    alter table public.team_tasks drop constraint team_tasks_assignment_type_check;
  end if;

  alter table public.team_tasks
    add constraint team_tasks_assignment_type_check
    check (assignment_type in ('all', 'selected'));
end $$;

create table if not exists public.team_task_assignments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.team_tasks(id) on delete cascade,
  team_code text not null references public.teams(team_code) on delete cascade,
  app_user_id uuid not null references public.app_users(id) on delete cascade,
  status text not null default 'assigned',
  assigned_at timestamptz not null default now(),
  completed_count integer not null default 0,
  completed_at timestamptz,
  unique (task_id, app_user_id)
);

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.team_task_assignments'::regclass
      and conname = 'team_task_assignments_status_check'
  ) then
    alter table public.team_task_assignments drop constraint team_task_assignments_status_check;
  end if;

  alter table public.team_task_assignments
    add constraint team_task_assignments_status_check
    check (status in ('assigned', 'completed'));
end $$;

create index if not exists team_task_assignments_task_idx
  on public.team_task_assignments (task_id);

create index if not exists team_task_assignments_team_user_idx
  on public.team_task_assignments (team_code, app_user_id);

create index if not exists team_tasks_assignment_status_idx
  on public.team_tasks (team_code, assignment_type, status, created_at desc);

-- Backfill assignment rows for legacy all-member tasks.
insert into public.team_task_assignments (
  task_id,
  team_code,
  app_user_id,
  status,
  assigned_at
)
select
  t.id,
  t.team_code,
  m.app_user_id,
  'assigned',
  coalesce(t.created_at, now())
from public.team_tasks t
join public.team_members m
  on m.team_code = t.team_code
where coalesce(t.assignment_type, 'all') = 'all'
  and m.status = 'active'
  and m.app_user_id is not null
on conflict (task_id, app_user_id) do nothing;

-- Team preparation board + removal of the retired team Super Lin Wan scope.
-- Run after supabase-prematch-prep.sql and supabase-team-task-4.sql.
-- Safe to run repeatedly. Take a database backup before the first run because
-- the precisely scoped cleanup is intentionally not reversible.

begin;

create table if not exists public.team_matches (
  id uuid primary key default gen_random_uuid(),
  team_code text not null references public.teams(team_code) on delete cascade,
  competition_name text not null,
  debate_topic text not null,
  stance text not null,
  competition_time timestamptz,
  format_info text not null default '',
  announcement text not null default '',
  status text not null default 'active',
  created_by uuid not null references public.app_users(id) on delete restrict,
  updated_by uuid references public.app_users(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_matches_stance_check
    check (stance in ('affirmative', 'negative', 'undecided')),
  constraint team_matches_status_check
    check (status in ('active', 'archived'))
);

create unique index if not exists team_matches_one_active_per_team_idx
  on public.team_matches (team_code)
  where status = 'active';

create index if not exists team_matches_team_created_idx
  on public.team_matches (team_code, created_at desc);

alter table public.team_tasks
  add column if not exists match_id uuid references public.team_matches(id) on delete restrict,
  add column if not exists task_category text not null default 'daily_training',
  add column if not exists task_source text not null default 'training';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.team_tasks'::regclass
      and conname = 'team_tasks_category_check'
  ) then
    alter table public.team_tasks add constraint team_tasks_category_check
      check (task_category in ('current_match', 'daily_training', 'other'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.team_tasks'::regclass
      and conname = 'team_tasks_source_check'
  ) then
    alter table public.team_tasks add constraint team_tasks_source_check
      check (task_source in ('training', 'manual'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.team_tasks'::regclass
      and conname = 'team_tasks_match_category_check'
  ) then
    alter table public.team_tasks add constraint team_tasks_match_category_check
      check (
        (task_category = 'current_match' and match_id is not null)
        or task_category <> 'current_match'
      );
  end if;
end $$;

create index if not exists team_tasks_match_category_created_idx
  on public.team_tasks (team_code, match_id, task_category, created_at desc);

alter table public.team_task_assignments
  add column if not exists completed_by uuid references public.app_users(id) on delete set null,
  add column if not exists completed_by_role text,
  add column if not exists completion_note text not null default '',
  add column if not exists training_record_id uuid references public.training_records(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.team_task_assignments'::regclass
      and conname = 'team_task_assignments_completed_by_role_check'
  ) then
    alter table public.team_task_assignments
      add constraint team_task_assignments_completed_by_role_check
      check (completed_by_role is null or completed_by_role in ('member', 'leader', 'admin'));
  end if;
end $$;

do $$
declare
  task_count bigint;
  message_count bigint;
  link_count bigint;
  personal_task_count bigint;
  personal_message_count bigint;
begin
  select count(*) into task_count
    from public.prematch_tasks
    where space_type = 'team'
      and team_code is not null;
  select count(*) into message_count
    from public.prematch_messages m
    join public.prematch_tasks t on t.id = m.task_id
    where t.space_type = 'team'
      and t.team_code is not null;
  select count(*) into link_count
    from public.prematch_training_links l
    join public.prematch_tasks t on t.id = l.task_id
    where t.space_type = 'team'
      and t.team_code is not null;
  select count(*) into personal_task_count
    from public.prematch_tasks
    where space_type = 'personal' and team_code is null;
  select count(*) into personal_message_count
    from public.prematch_messages m
    join public.prematch_tasks t on t.id = m.task_id
    where t.space_type = 'personal' and t.team_code is null;
  raise notice
    'BEFORE retired team Super Lin Wan cleanup: tasks=%, messages=%, links=%, preserved personal tasks=%, preserved personal messages=%',
    task_count, message_count, link_count, personal_task_count, personal_message_count;
end $$;

delete from public.prematch_messages m
where exists (
  select 1
  from public.prematch_tasks t
  where t.id = m.task_id
    and t.space_type = 'team'
    and t.team_code is not null
);

delete from public.prematch_training_links l
where exists (
  select 1
  from public.prematch_tasks t
  where t.id = l.task_id
    and t.space_type = 'team'
    and t.team_code is not null
);

delete from public.prematch_tasks t
where t.space_type = 'team'
  and t.team_code is not null;

do $$
declare
  remaining_task_count bigint;
  remaining_message_count bigint;
  remaining_link_count bigint;
  personal_task_count bigint;
  personal_message_count bigint;
begin
  select count(*) into remaining_task_count
    from public.prematch_tasks
    where space_type = 'team'
      and team_code is not null;
  select count(*) into remaining_message_count
    from public.prematch_messages m
    join public.prematch_tasks t on t.id = m.task_id
    where t.space_type = 'team'
      and t.team_code is not null;
  select count(*) into remaining_link_count
    from public.prematch_training_links l
    join public.prematch_tasks t on t.id = l.task_id
    where t.space_type = 'team'
      and t.team_code is not null;
  select count(*) into personal_task_count
    from public.prematch_tasks
    where space_type = 'personal' and team_code is null;
  select count(*) into personal_message_count
    from public.prematch_messages m
    join public.prematch_tasks t on t.id = m.task_id
    where t.space_type = 'personal' and t.team_code is null;
  raise notice
    'AFTER retired team Super Lin Wan cleanup: remaining tasks=%, messages=%, links=%, preserved personal tasks=%, preserved personal messages=%',
    remaining_task_count, remaining_message_count, remaining_link_count,
    personal_task_count, personal_message_count;
end $$;

alter table public.prematch_tasks
  drop constraint if exists prematch_tasks_space_type_check,
  drop constraint if exists prematch_tasks_space_team_check;

alter table public.prematch_tasks
  add constraint prematch_tasks_space_type_check
    check (space_type = 'personal'),
  add constraint prematch_tasks_space_team_check
    check (space_type = 'personal' and team_code is null);

alter table public.team_matches enable row level security;
alter table public.team_tasks enable row level security;
alter table public.team_task_assignments enable row level security;
revoke all on table public.team_matches from anon, authenticated;
revoke all on table public.team_tasks from anon, authenticated;
revoke all on table public.team_task_assignments from anon, authenticated;

comment on table public.team_matches is
  'One active preparation match per team. Read/write authorization is enforced by the custom-JWT backend.';
comment on column public.team_task_assignments.completed_by is
  'Actor who last marked this assignee complete; may differ from app_user_id for manager actions.';
comment on column public.team_task_assignments.completed_by_role is
  'Role snapshot of the completion actor: member, leader, or admin.';

commit;

-- Super Lin Wan / pre-match preparation migration.
-- Run after supabase-auth-1.sql, supabase-team-spaces.sql and
-- supabase-scoring-rubrics.sql. Safe to execute repeatedly.
--
-- Authentication note:
-- Fengbian uses its own app_users + JWT authentication. The backend accesses
-- Supabase with service_role and performs ownership/team-membership checks from
-- req.user.id. Direct anon/authenticated access remains denied.

create table if not exists public.prematch_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.app_users(id) on delete cascade,
  space_type text not null default 'personal',
  team_code text references public.teams(team_code) on delete cascade,
  title text not null,
  debate_topic text not null,
  stance text not null,
  debate_position text not null,
  position_detail text not null default '',
  competition_name text not null default '',
  competition_date timestamptz,
  competition_level text not null default '',
  format text not null default '',
  preparation_deadline timestamptz,
  initial_ideas text not null default '',
  opponent_info text not null default '',
  priority_question text not null default '',
  status text not null default 'active',
  current_stage text not null default 'understanding',
  strategy_state jsonb not null default '{}'::jsonb,
  context_summary text not null default '',
  version integer not null default 1,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prematch_tasks_space_type_check
    check (space_type in ('personal', 'team')),
  constraint prematch_tasks_space_team_check
    check (
      (space_type = 'personal' and team_code is null)
      or (space_type = 'team' and team_code is not null)
    ),
  constraint prematch_tasks_stance_check
    check (stance in ('affirmative', 'negative', 'undecided')),
  constraint prematch_tasks_position_check
    check (debate_position in ('first', 'second', 'third', 'fourth', 'undecided', 'other')),
  constraint prematch_tasks_status_check
    check (status in ('active', 'archived')),
  constraint prematch_tasks_stage_check
    check (current_stage in ('understanding', 'analysis', 'brainstorming', 'strategy', 'training', 'ready')),
  constraint prematch_tasks_strategy_object_check
    check (jsonb_typeof(strategy_state) = 'object'),
  constraint prematch_tasks_version_check
    check (version >= 1)
);

create index if not exists prematch_tasks_owner_status_updated_idx
  on public.prematch_tasks (owner_user_id, status, updated_at desc);

create index if not exists prematch_tasks_team_status_updated_idx
  on public.prematch_tasks (team_code, status, updated_at desc)
  where space_type = 'team';

create table if not exists public.prematch_messages (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.prematch_tasks(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete cascade,
  role text not null,
  content text not null,
  structured_update jsonb,
  context_manifest jsonb,
  client_request_id uuid,
  created_at timestamptz not null default now(),
  constraint prematch_messages_role_check
    check (role in ('user', 'assistant')),
  constraint prematch_messages_structured_object_check
    check (structured_update is null or jsonb_typeof(structured_update) = 'object'),
  constraint prematch_messages_manifest_object_check
    check (context_manifest is null or jsonb_typeof(context_manifest) = 'object')
);

create index if not exists prematch_messages_task_created_id_idx
  on public.prematch_messages (task_id, created_at desc, id desc);

create unique index if not exists prematch_messages_request_role_unique
  on public.prematch_messages (task_id, client_request_id, role)
  where client_request_id is not null;

create table if not exists public.prematch_training_links (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.prematch_tasks(id) on delete cascade,
  training_record_id uuid references public.training_records(id) on delete set null,
  user_id uuid not null references public.app_users(id) on delete cascade,
  training_mode text not null,
  training_goal text not null default '',
  verification_question text not null default '',
  strategy_summary text not null default '',
  result_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint prematch_training_mode_check
    check (training_mode in ('constructive', 'summary', 'free_debate', 'attack', 'defense', 'closing')),
  constraint prematch_training_result_object_check
    check (jsonb_typeof(result_summary) = 'object')
);

create unique index if not exists prematch_training_links_record_unique
  on public.prematch_training_links (training_record_id)
  where training_record_id is not null;

create index if not exists prematch_training_links_task_created_idx
  on public.prematch_training_links (task_id, created_at desc);

alter table public.prematch_tasks enable row level security;
alter table public.prematch_messages enable row level security;
alter table public.prematch_training_links enable row level security;

revoke all on table public.prematch_tasks from anon, authenticated;
revoke all on table public.prematch_messages from anon, authenticated;
revoke all on table public.prematch_training_links from anon, authenticated;

comment on table public.prematch_tasks is
  'Task-scoped Super Lin Wan preparation state. Access is enforced by the custom-auth backend.';
comment on table public.prematch_messages is
  'Messages isolated by pre-match task_id; never shared with daily linwan_messages.';
comment on table public.prematch_training_links is
  'Structured links from a preparation task to an existing formal training record.';

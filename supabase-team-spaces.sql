-- Multi-team + personal training spaces migration.
-- Run in Supabase SQL Editor before deploying the matching backend.
-- Password note: new backend writes join_password_hash and clears join_password.
-- Existing plaintext join_password values remain readable for migration compatibility.

create table if not exists public.teams (
  team_code text primary key,
  team_name text not null,
  join_password_hash text,
  join_password text,
  created_at timestamptz not null default now()
);

alter table public.teams
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists team_name text,
  add column if not exists join_password_hash text,
  add column if not exists join_password text,
  add column if not exists created_at timestamptz default now();

update public.teams
set
  id = coalesce(id, gen_random_uuid()),
  team_name = coalesce(nullif(team_name, ''), team_code),
  created_at = coalesce(created_at, now());

alter table public.teams
  alter column id set not null,
  alter column team_name set not null,
  alter column created_at set not null;

create unique index if not exists teams_id_key on public.teams (id);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_code text not null references public.teams(team_code) on delete cascade,
  local_user_id text not null,
  nickname text not null,
  role text not null default 'member',
  status text not null default 'active' check (status in ('active', 'left')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.team_members
  add column if not exists role text default 'member',
  add column if not exists status text default 'active',
  add column if not exists joined_at timestamptz,
  add column if not exists left_at timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists last_seen_at timestamptz default now();

update public.team_members
set
  role = coalesce(nullif(role, ''), 'member'),
  status = coalesce(nullif(status, ''), 'active'),
  joined_at = coalesce(joined_at, created_at, now()),
  created_at = coalesce(created_at, now()),
  last_seen_at = coalesce(last_seen_at, now());

alter table public.team_members
  alter column role set not null,
  alter column status set not null,
  alter column joined_at set not null,
  alter column created_at set not null,
  alter column last_seen_at set not null;

do $$
begin
  alter table public.team_members
    add constraint team_members_team_user_unique unique (team_code, local_user_id);
exception
  when duplicate_object then null;
end $$;

create table if not exists public.training_records (
  id uuid primary key default gen_random_uuid(),
  space_type text not null default 'personal' check (space_type in ('personal', 'team')),
  team_code text references public.teams(team_code) on delete cascade,
  local_user_id text not null,
  nickname text not null,
  topic text not null,
  user_side text not null check (user_side in ('affirmative', 'negative')),
  ai_side text not null check (ai_side in ('affirmative', 'negative')),
  difficulty text not null check (difficulty in ('novice', 'campus', 'city')),
  style_id text not null default 'none',
  training_mode text not null default 'free_debate',
  messages jsonb not null default '[]'::jsonb,
  review text not null,
  score integer check (score is null or (score >= 0 and score <= 100)),
  result text,
  battlefield text,
  created_at timestamptz not null default now()
);

alter table public.training_records
  add column if not exists space_type text,
  add column if not exists training_mode text not null default 'free_debate',
  add column if not exists battlefield text;

alter table public.training_records
  alter column team_code drop not null;

update public.training_records
set space_type = case
  when team_code is null then 'personal'
  when team_code like 'PERSONAL_%' then 'personal'
  else 'team'
end
where space_type is null;

update public.training_records
set team_code = null
where space_type = 'personal';

alter table public.training_records
  alter column space_type set default 'personal',
  alter column space_type set not null;

do $$
begin
  alter table public.training_records
    add constraint training_records_space_type_check check (space_type in ('personal', 'team'));
exception
  when duplicate_object then null;
end $$;

create index if not exists training_records_personal_created_idx
  on public.training_records (space_type, local_user_id, created_at desc);

create index if not exists training_records_space_team_created_idx
  on public.training_records (space_type, team_code, created_at desc);

create index if not exists training_records_team_member_created_idx
  on public.training_records (space_type, team_code, local_user_id, created_at desc);

create index if not exists team_members_team_idx
  on public.team_members (team_code);

create index if not exists team_members_user_status_idx
  on public.team_members (local_user_id, status);

with ranked_owners as (
  select
    id,
    row_number() over (
      partition by team_code
      order by joined_at asc, created_at asc, id asc
    ) as owner_rank
  from public.team_members
  where role = 'owner' and status = 'active'
)
update public.team_members
set role = 'member'
where id in (
  select id
  from ranked_owners
  where owner_rank > 1
);

create unique index if not exists team_members_one_active_owner_idx
  on public.team_members (team_code)
  where role = 'owner' and status = 'active';

create or replace function public.transfer_team_owner(
  p_team_code text,
  p_current_owner_id text,
  p_new_owner_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.team_members
    where team_code = p_team_code
      and local_user_id = p_current_owner_id
      and role = 'owner'
      and status = 'active'
  ) then
    raise exception 'current user is not active owner' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.team_members
    where team_code = p_team_code
      and local_user_id = p_new_owner_id
      and status = 'active'
  ) then
    raise exception 'target user is not active member' using errcode = '42501';
  end if;

  if p_current_owner_id = p_new_owner_id then
    return;
  end if;

  update public.team_members
  set role = 'member'
  where team_code = p_team_code
    and local_user_id = p_current_owner_id
    and status = 'active';

  update public.team_members
  set role = 'owner'
  where team_code = p_team_code
    and local_user_id = p_new_owner_id
    and status = 'active';
end;
$$;

-- Optional one-time plaintext password cleanup after all teams use hashes:
-- update public.teams set join_password = null where join_password_hash is not null;

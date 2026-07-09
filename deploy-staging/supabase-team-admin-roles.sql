-- Team roles migration: leader / admin / member.
-- Safe migration: does not clear existing data.

alter table public.team_members
  add column if not exists role text not null default 'member';

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.team_members'::regclass
      and conname = 'team_members_role_check'
  ) then
    alter table public.team_members drop constraint team_members_role_check;
  end if;
end $$;

update public.team_members
set role = 'leader'
where role in ('owner', 'captain');

update public.team_members
set role = 'member'
where role is null or role = '';

do $$
begin
  alter table public.team_members
    add constraint team_members_role_check
    check (role in ('leader', 'admin', 'member'));
end $$;

create index if not exists team_members_team_role_idx
  on public.team_members (team_code, role, status);

drop index if exists public.team_members_one_active_owner_idx;

create unique index if not exists team_members_one_active_leader_idx
  on public.team_members (team_code)
  where role = 'leader' and status = 'active';

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
      and role = 'leader'
      and status = 'active'
  ) then
    raise exception 'current user is not active leader' using errcode = '42501';
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
  set role = 'leader'
  where team_code = p_team_code
    and local_user_id = p_new_owner_id
    and status = 'active';
end;
$$;

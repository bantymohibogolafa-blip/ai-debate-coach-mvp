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

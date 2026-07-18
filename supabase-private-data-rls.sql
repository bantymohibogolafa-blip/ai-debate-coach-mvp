-- Defense-in-depth RLS for Fengbian's custom-auth backend.
-- The application authenticates users itself and accesses Supabase only with the
-- service-role key, so anon/authenticated clients must not access these tables.
-- Safe for the current backend: service_role bypasses RLS.

alter table if exists public.app_users enable row level security;
alter table if exists public.training_records enable row level security;
alter table if exists public.teams enable row level security;
alter table if exists public.team_members enable row level security;
alter table if exists public.team_tasks enable row level security;
alter table if exists public.team_task_assignments enable row level security;
alter table if exists public.linwan_messages enable row level security;
alter table if exists public.linwan_memory enable row level security;
alter table if exists public.linwan_user_profile enable row level security;

-- Custom application JWTs are not Supabase Auth JWTs. Do not add auth.uid()
-- policies for these tables unless authentication is migrated to Supabase Auth.
-- With no client policies, RLS denies anon/authenticated access by default.
revoke all on table public.app_users from anon, authenticated;
revoke all on table public.training_records from anon, authenticated;
revoke all on table public.teams from anon, authenticated;
revoke all on table public.team_members from anon, authenticated;
revoke all on table public.team_tasks from anon, authenticated;
revoke all on table public.team_task_assignments from anon, authenticated;
revoke all on table public.linwan_messages from anon, authenticated;
revoke all on table public.linwan_memory from anon, authenticated;
revoke all on table public.linwan_user_profile from anon, authenticated;

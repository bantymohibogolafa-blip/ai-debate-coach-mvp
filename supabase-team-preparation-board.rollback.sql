-- Structural rollback for supabase-team-preparation-board.sql.
-- WARNING: this cannot restore retired team Super Lin Wan rows. Restore those
-- from the pre-migration database backup if the cleanup itself must be undone.

begin;

alter table public.team_task_assignments
  drop constraint if exists team_task_assignments_completed_by_role_check,
  drop column if exists updated_at,
  drop column if exists training_record_id,
  drop column if exists completion_note,
  drop column if exists completed_by_role,
  drop column if exists completed_by;

alter table public.team_tasks
  drop constraint if exists team_tasks_match_category_check,
  drop constraint if exists team_tasks_source_check,
  drop constraint if exists team_tasks_category_check,
  drop column if exists task_source,
  drop column if exists task_category,
  drop column if exists match_id;

drop table if exists public.team_matches;

alter table public.prematch_tasks
  drop constraint if exists prematch_tasks_space_type_check,
  drop constraint if exists prematch_tasks_space_team_check;

alter table public.prematch_tasks
  add constraint prematch_tasks_space_type_check
    check (space_type in ('personal', 'team')),
  add constraint prematch_tasks_space_team_check
    check (
      (space_type = 'personal' and team_code is null)
      or (space_type = 'team' and team_code is not null)
    );

commit;

-- Lin Wan history, preferences, and context transparency migration.
-- Run after supabase-auth-1.sql and supabase-linwan-memory.sql.
-- Safe to execute repeatedly. The legacy linwan_memory table is intentionally preserved.

create table if not exists public.linwan_user_profile (
  user_id uuid primary key references public.app_users(id) on delete cascade,
  preferred_name text not null default '',
  response_length text not null default 'balanced',
  communication_style text not null default 'balanced',
  answer_order text not null default 'auto',
  terminology_level text not null default 'normal',
  custom_preference text not null default '',
  auto_show_context boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint linwan_profile_preferred_name_length_check
    check (char_length(preferred_name) <= 12),
  constraint linwan_profile_preferred_name_control_check
    check (preferred_name !~ '[[:cntrl:]]'),
  constraint linwan_profile_response_length_check
    check (response_length in ('concise', 'balanced', 'detailed')),
  constraint linwan_profile_communication_style_check
    check (communication_style in ('direct', 'balanced', 'gentle')),
  constraint linwan_profile_answer_order_check
    check (answer_order in ('conclusion_first', 'analysis_first', 'auto')),
  constraint linwan_profile_terminology_level_check
    check (terminology_level in ('plain', 'normal', 'professional')),
  constraint linwan_profile_custom_preference_length_check
    check (char_length(custom_preference) <= 200),
  constraint linwan_profile_custom_preference_control_check
    check (custom_preference !~ '[[:cntrl:]]')
);

alter table public.linwan_messages
  add column if not exists context_manifest jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.linwan_messages'::regclass
      and conname = 'linwan_messages_context_manifest_object_check'
  ) then
    alter table public.linwan_messages
      add constraint linwan_messages_context_manifest_object_check
      check (context_manifest is null or jsonb_typeof(context_manifest) = 'object');
  end if;
end $$;

create index if not exists linwan_messages_user_idx
  on public.linwan_messages (user_id);

create index if not exists linwan_messages_user_created_id_idx
  on public.linwan_messages (user_id, created_at desc, id desc);

create unique index if not exists linwan_user_profile_user_idx
  on public.linwan_user_profile (user_id);

alter table public.linwan_user_profile enable row level security;

drop policy if exists "Users can read own linwan profile" on public.linwan_user_profile;
drop policy if exists "Users can insert own linwan profile" on public.linwan_user_profile;
drop policy if exists "Users can update own linwan profile" on public.linwan_user_profile;
drop policy if exists "Users can delete own linwan profile" on public.linwan_user_profile;

create policy "Users can read own linwan profile"
on public.linwan_user_profile
for select
using (auth.uid() = user_id);

create policy "Users can insert own linwan profile"
on public.linwan_user_profile
for insert
with check (auth.uid() = user_id);

create policy "Users can update own linwan profile"
on public.linwan_user_profile
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own linwan profile"
on public.linwan_user_profile
for delete
using (auth.uid() = user_id);

-- The custom backend uses a Supabase service-role key and applies ownership from req.user.id.
-- These policies remain as defense in depth if direct authenticated access is introduced later.

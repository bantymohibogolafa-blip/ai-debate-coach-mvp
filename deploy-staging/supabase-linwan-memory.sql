-- Lin Wan lightweight memory migration.
-- Stores recent Lin Wan chat context and one compact debate-training memory summary per app user.
-- Run after supabase-auth-1.sql.

create table if not exists public.linwan_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamp with time zone default now()
);

create index if not exists linwan_messages_user_created_idx
  on public.linwan_messages (user_id, created_at desc);

create table if not exists public.linwan_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  memory_summary text not null default '',
  updated_at timestamp with time zone default now()
);

create index if not exists linwan_memory_user_idx
  on public.linwan_memory (user_id);

alter table public.linwan_messages enable row level security;
alter table public.linwan_memory enable row level security;

drop policy if exists "Users can read own linwan messages" on public.linwan_messages;
drop policy if exists "Users can insert own linwan messages" on public.linwan_messages;
drop policy if exists "Users can delete own linwan messages" on public.linwan_messages;
drop policy if exists "Users can read own linwan memory" on public.linwan_memory;
drop policy if exists "Users can insert own linwan memory" on public.linwan_memory;
drop policy if exists "Users can update own linwan memory" on public.linwan_memory;
drop policy if exists "Users can delete own linwan memory" on public.linwan_memory;

create policy "Users can read own linwan messages"
on public.linwan_messages
for select
using (auth.uid() = user_id);

create policy "Users can insert own linwan messages"
on public.linwan_messages
for insert
with check (auth.uid() = user_id);

create policy "Users can delete own linwan messages"
on public.linwan_messages
for delete
using (auth.uid() = user_id);

create policy "Users can read own linwan memory"
on public.linwan_memory
for select
using (auth.uid() = user_id);

create policy "Users can insert own linwan memory"
on public.linwan_memory
for insert
with check (auth.uid() = user_id);

create policy "Users can update own linwan memory"
on public.linwan_memory
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own linwan memory"
on public.linwan_memory
for delete
using (auth.uid() = user_id);

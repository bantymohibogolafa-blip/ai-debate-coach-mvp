-- Scoring rubric metadata migration for Fengbian.
-- Run this in Supabase SQL Editor. This migration does not clear data.

alter table public.training_records
  add column if not exists mode_display_name text,
  add column if not exists score_level text,
  add column if not exists dimension_scores jsonb not null default '[]'::jsonb;

create index if not exists training_records_mode_score_idx
  on public.training_records (training_mode, score_level);


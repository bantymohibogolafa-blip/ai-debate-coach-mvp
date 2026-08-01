-- Text rubric V2 metadata only. Existing scores and reviews are intentionally untouched.
alter table public.training_records
  add column if not exists rubric_version text;

create index if not exists training_records_rubric_version_idx
  on public.training_records (rubric_version, created_at desc);

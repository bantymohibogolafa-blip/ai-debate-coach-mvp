-- Version metadata for training scores and ability-profile processing.
-- This migration preserves all existing scores, reviews and dimension JSON.

alter table public.training_records
  add column if not exists scoring_version text,
  add column if not exists rubric_id text,
  add column if not exists projection_version text,
  add column if not exists difficulty_calibration_version text,
  add column if not exists estimator_version text;

update public.training_records
set scoring_version = case
  when dimension_scores is null
    or jsonb_typeof(dimension_scores) <> 'array'
    or jsonb_array_length(dimension_scores) = 0
    then 'legacy_missing'
  when exists (
    select 1
    from jsonb_array_elements(dimension_scores) as dimension
    cross join lateral (
      select coalesce(
        nullif(dimension ->> 'maxScore', ''),
        nullif(dimension ->> 'max_score', ''),
        '100'
      ) as max_score_text
    ) as normalized
    where normalized.max_score_text ~ '^[0-9]+([.][0-9]+)?$'
      and normalized.max_score_text::numeric <> 100
  )
    then 'legacy_subscore'
  else 'legacy_percentile_unknown'
end
where scoring_version is null or btrim(scoring_version) = '';

update public.training_records
set
  rubric_id = coalesce(nullif(btrim(rubric_id), ''), 'legacy_unknown'),
  projection_version = coalesce(nullif(btrim(projection_version), ''), 'legacy_unknown'),
  difficulty_calibration_version = coalesce(
    nullif(btrim(difficulty_calibration_version), ''),
    'legacy_unknown'
  ),
  estimator_version = coalesce(nullif(btrim(estimator_version), ''), 'legacy_unknown')
where scoring_version like 'legacy_%';

create index if not exists training_records_scoring_version_idx
  on public.training_records (scoring_version, created_at desc);


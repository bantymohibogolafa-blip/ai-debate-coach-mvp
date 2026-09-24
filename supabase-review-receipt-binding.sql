-- P1-1: bind each saved training record to one server-issued review.
-- Existing historical records retain NULL. New API saves always provide review_id.
ALTER TABLE public.training_records
  ADD COLUMN IF NOT EXISTS review_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS training_records_review_id_unique
  ON public.training_records (review_id)
  WHERE review_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';

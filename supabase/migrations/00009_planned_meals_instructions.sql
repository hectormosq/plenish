ALTER TABLE public.planned_meals
  ADD COLUMN IF NOT EXISTS instructions text;

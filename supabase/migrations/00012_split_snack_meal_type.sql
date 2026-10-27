-- 084: split the 'snack' meal type into 'mid_morning_snack' (media mañana)
-- and 'afternoon_snack' (merienda).
--
-- Existing logged snacks are assigned by the hour they were eaten, in
-- Europe/Madrid: before 13:00 → mid-morning, otherwise afternoon.
-- Planned snacks have no time of day, so they become afternoon snacks.

-- meal_logs has no create migration in this repo, so drop any meal_type
-- CHECK by lookup instead of by a guessed name.
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT conrelid::regclass AS tbl, conname
    FROM pg_constraint
    WHERE contype = 'c'
      AND conrelid IN ('public.meal_logs'::regclass, 'public.planned_meals'::regclass)
      AND pg_get_constraintdef(oid) ILIKE '%meal_type%'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', c.tbl, c.conname);
  END LOOP;
END $$;

UPDATE public.meal_logs
SET meal_type = CASE
  WHEN extract(hour FROM eaten_at AT TIME ZONE 'Europe/Madrid') < 13 THEN 'mid_morning_snack'
  ELSE 'afternoon_snack'
END
WHERE meal_type = 'snack';

UPDATE public.planned_meals
SET meal_type = 'afternoon_snack'
WHERE meal_type = 'snack';

ALTER TABLE public.meal_logs
  ADD CONSTRAINT meal_logs_meal_type_check
  CHECK (meal_type IN ('breakfast', 'mid_morning_snack', 'lunch', 'afternoon_snack', 'dinner'));

ALTER TABLE public.planned_meals
  ADD CONSTRAINT planned_meals_meal_type_check
  CHECK (meal_type IN ('breakfast', 'mid_morning_snack', 'lunch', 'afternoon_snack', 'dinner'));

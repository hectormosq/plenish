-- ─── Planned Meals ───────────────────────────────────────────────────────────
-- Stores on-demand AI meal recommendations.
-- Separate from meal_logs (things actually eaten) to keep that table clean.
-- No UNIQUE constraint on (user_id, meal_type, planned_date) — multiple rows
-- per slot are kept as history for learning (latest status='planned' wins).

CREATE TABLE IF NOT EXISTS public.planned_meals (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  meal_type            text        NOT NULL CHECK (meal_type IN ('breakfast','snack','lunch','dinner')),
  planned_date         date        NOT NULL,
  name                 text        NOT NULL,
  description          text,
  reason               text,
  ingredients          text[],
  prep_time_minutes    int,
  estimated_calories   int,

  -- Lifecycle
  status               text        NOT NULL DEFAULT 'planned'
                         CHECK (status IN ('planned','accepted','dismissed','overridden','expired')),

  -- Learning links
  accepted_meal_id     uuid        REFERENCES public.meal_logs(id) ON DELETE SET NULL,
  overridden_meal_id   uuid        REFERENCES public.meal_logs(id) ON DELETE SET NULL,

  created_at           timestamptz NOT NULL DEFAULT now()
);

-- Efficient lookup for active plans per slot
CREATE INDEX IF NOT EXISTS planned_meals_active_idx
  ON public.planned_meals (user_id, planned_date, meal_type)
  WHERE status = 'planned';

ALTER TABLE public.planned_meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planned_meals: select own" ON public.planned_meals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "planned_meals: insert own" ON public.planned_meals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "planned_meals: update own" ON public.planned_meals
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "planned_meals: delete own" ON public.planned_meals
  FOR DELETE USING (auth.uid() = user_id);

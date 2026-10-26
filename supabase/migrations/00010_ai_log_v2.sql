-- ─── AI meal logging v2 (feature 045) ───────────────────────────────────────
-- Adds ingredient-level meal records, per-user pipeline preference, a developer
-- whitelist (for the shadow comparison mode) and per-run telemetry so v1 and v2
-- can be compared. See specs/045-ai-log-v2/data-model.md.

-- ─── 1. Developer whitelist ─────────────────────────────────────────────────
-- Managed by the team only (SQL editor / service role). Users can only check
-- whether their own account is on it.

CREATE TABLE IF NOT EXISTS public.developer_whitelist (
  user_id    uuid        PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.developer_whitelist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "developer_whitelist: select own" ON public.developer_whitelist
  FOR SELECT USING (auth.uid() = user_id);
-- No INSERT / UPDATE / DELETE policies on purpose.

-- ─── 2. is_developer() helper ───────────────────────────────────────────────
-- SECURITY DEFINER so the preference trigger can read the whitelist for any row.

CREATE OR REPLACE FUNCTION public.is_developer(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.developer_whitelist WHERE user_id = uid);
$$;

-- ─── 3. User preferences ────────────────────────────────────────────────────
-- No row = 'v1'. Removing a user from the whitelist does not touch this table;
-- the app downgrades 'v2_shadow_v1' to 'v2' at read time.

CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id      uuid        PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  log_pipeline text        NOT NULL DEFAULT 'v1'
                 CHECK (log_pipeline IN ('v1', 'v2', 'v2_shadow_v1')),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_preferences: select own" ON public.user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_preferences: insert own" ON public.user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_preferences: update own" ON public.user_preferences
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.user_preferences_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.log_pipeline = 'v2_shadow_v1' AND NOT public.is_developer(NEW.user_id) THEN
    RAISE EXCEPTION 'shadow_requires_developer' USING ERRCODE = 'P0001';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_preferences_guard ON public.user_preferences;
CREATE TRIGGER user_preferences_guard
  BEFORE INSERT OR UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.user_preferences_guard();

-- ─── 4. meal_logs: pipeline marker and estimated flag ───────────────────────
-- log_pipeline is null for form logs and meals logged before this feature.

ALTER TABLE public.meal_logs
  ADD COLUMN IF NOT EXISTS log_pipeline text CHECK (log_pipeline IN ('v1', 'v2')),
  ADD COLUMN IF NOT EXISTS is_estimated boolean NOT NULL DEFAULT false;

-- ─── 5. Meal ingredients (v2) ───────────────────────────────────────────────
-- One row per ingredient. No kcal/macros: they will be calculated from
-- quantity_g by a food-composition follow-up (research R12).

CREATE TABLE IF NOT EXISTS public.meal_log_ingredients (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_log_id      uuid         NOT NULL REFERENCES public.meal_logs(id) ON DELETE CASCADE,
  user_id          uuid         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  dish_name        text         NOT NULL CHECK (char_length(dish_name) BETWEEN 1 AND 120),
  dish_key         text         NOT NULL,
  position         smallint     NOT NULL CHECK (position >= 0),
  name             text         NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  quantity_g       numeric(7,1) NOT NULL CHECK (quantity_g > 0),
  quantity_source  text         NOT NULL
                     CHECK (quantity_source IN ('stated', 'estimated', 'history', 'user')),
  confidence_score numeric(3,2) CHECK (confidence_score BETWEEN 0 AND 1),
  confidence_level text         NOT NULL CHECK (confidence_level IN ('high', 'medium', 'low')),
  created_at       timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meal_log_ingredients_meal_idx
  ON public.meal_log_ingredients (meal_log_id, position);

-- History lookup: latest rows of a dish for a user.
CREATE INDEX IF NOT EXISTS meal_log_ingredients_history_idx
  ON public.meal_log_ingredients (user_id, dish_key, created_at DESC);

ALTER TABLE public.meal_log_ingredients ENABLE ROW LEVEL SECURITY;

-- Visibility follows the meal: the subquery runs under the meal_logs policy
-- ("select own or shared"), so co-eaters see the ingredients of shared meals.
CREATE POLICY "meal_log_ingredients: select visible meal" ON public.meal_log_ingredients
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.meal_logs ml WHERE ml.id = meal_log_id)
  );

CREATE POLICY "meal_log_ingredients: insert own" ON public.meal_log_ingredients
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.meal_logs ml
      WHERE ml.id = meal_log_id AND ml.user_id = auth.uid()
    )
  );

CREATE POLICY "meal_log_ingredients: update own" ON public.meal_log_ingredients
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "meal_log_ingredients: delete own" ON public.meal_log_ingredients
  FOR DELETE USING (auth.uid() = user_id);

-- ─── 6. Pipeline runs (telemetry) ───────────────────────────────────────────
-- One row per pipeline execution on a meal-logging turn (log, mixed, form).
-- correlation_id pairs a v2 run with its shadow v1 run on the same message.

CREATE TABLE IF NOT EXISTS public.ai_pipeline_runs (
  id                     uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  correlation_id         uuid          NOT NULL,
  variant                text          NOT NULL CHECK (variant IN ('v1', 'v2')),
  is_shadow              boolean       NOT NULL DEFAULT false,
  intent                 text,
  meal_log_id            uuid          REFERENCES public.meal_logs(id) ON DELETE SET NULL,
  model                  text,
  input_tokens           integer,
  output_tokens          integer,
  est_cost_usd           numeric(10,6),
  latency_ms             integer,
  steps                  jsonb         NOT NULL DEFAULT '[]'::jsonb,
  confidence_score       numeric(3,2)  CHECK (confidence_score BETWEEN 0 AND 1),
  confidence_level       text          CHECK (confidence_level IN ('high', 'medium', 'low')),
  outcome                text          CHECK (outcome IN ('saved', 'draft', 'question', 'error', 'shadow')),
  confirmation_requested boolean       NOT NULL DEFAULT false,
  user_corrected         boolean       NOT NULL DEFAULT false,
  error                  text,
  created_at             timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_pipeline_runs_correlation_idx
  ON public.ai_pipeline_runs (correlation_id);

CREATE INDEX IF NOT EXISTS ai_pipeline_runs_user_idx
  ON public.ai_pipeline_runs (user_id, created_at DESC);

ALTER TABLE public.ai_pipeline_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_pipeline_runs: select own" ON public.ai_pipeline_runs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "ai_pipeline_runs: insert own" ON public.ai_pipeline_runs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ai_pipeline_runs: update own" ON public.ai_pipeline_runs
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─── 7. Whitelisting a developer (run manually in the SQL editor) ───────────
-- INSERT INTO public.developer_whitelist (user_id, note)
-- SELECT id, 'log v2 comparison' FROM public.users WHERE email = '<email>';

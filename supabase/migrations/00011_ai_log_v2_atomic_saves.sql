-- ─── AI meal logging v2: safe saves (feature 045) ───────────────────────────
-- 1. meal_logs.ai_run_id: the v2 run that produced the meal. Unique, so the
--    same draft can never be saved twice (a double click, a chat "sí" plus the
--    button, a retried request). No FK: the run row is telemetry and may be
--    missing; the draft still needs to be saveable.
-- 2. replace_meal_log_ingredients(): rewrites a saved meal's ingredients and
--    nutrition in one transaction, so a failed insert cannot leave the meal
--    without ingredients.

-- ─── 1. meal_logs.ai_run_id ─────────────────────────────────────────────────

ALTER TABLE public.meal_logs
  ADD COLUMN IF NOT EXISTS ai_run_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS meal_logs_ai_run_id_key
  ON public.meal_logs (ai_run_id)
  WHERE ai_run_id IS NOT NULL;

-- ─── 2. replace_meal_log_ingredients() ──────────────────────────────────────
-- SECURITY INVOKER: every statement runs under the caller's RLS policies.
-- p_rows is an array of ingredient objects in meal_log_ingredients' shape
-- (without id, meal_log_id, user_id, created_at).

CREATE OR REPLACE FUNCTION public.replace_meal_log_ingredients(
  p_meal_id   uuid,
  p_rows      jsonb,
  p_nutrition jsonb,
  p_inferred  text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  UPDATE public.meal_logs
     SET nutrition = p_nutrition,
         inferred_ingredients = p_inferred
   WHERE id = p_meal_id AND user_id = v_user;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'meal_not_found' USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.meal_log_ingredients
   WHERE meal_log_id = p_meal_id AND user_id = v_user;

  INSERT INTO public.meal_log_ingredients
    (meal_log_id, user_id, dish_name, dish_key, position, name, quantity_g,
     quantity_source, confidence_score, confidence_level)
  SELECT p_meal_id, v_user, r.dish_name, r.dish_key, r.position, r.name, r.quantity_g,
         r.quantity_source, r.confidence_score, r.confidence_level
    FROM jsonb_to_recordset(p_rows) AS r(
      dish_name        text,
      dish_key         text,
      position         smallint,
      name             text,
      quantity_g       numeric,
      quantity_source  text,
      confidence_score numeric,
      confidence_level text
    );
END;
$$;

REVOKE ALL ON FUNCTION public.replace_meal_log_ingredients(uuid, jsonb, jsonb, text[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.replace_meal_log_ingredients(uuid, jsonb, jsonb, text[]) TO authenticated;

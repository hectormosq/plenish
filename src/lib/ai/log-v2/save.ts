import type { SupabaseClient } from '@supabase/supabase-js';
import { saveMealLogToDb } from '@/lib/ai/save-meal';
import { normalizeDishKey } from './dish-key';
import type { MealDraft } from './schemas';

// ---------------------------------------------------------------------------
// saveMealV2 — writes a v2 meal through the shared save path (household,
// co-eaters, planned-meal override) with one row per ingredient. The
// ingredients are written right after the meal row; if they fail, the meal is
// removed before the planned meal is overridden. The run id is unique on
// meal_logs, so a draft saved twice fails with `duplicate`.
// ---------------------------------------------------------------------------

export function inferredIngredientStrings(draft: Pick<MealDraft, 'dishes'>): string[] {
  return draft.dishes.flatMap((d) => d.ingredients.map((i) => `${i.name} (${i.quantity_g} g)`));
}

/** Ingredient rows without their owner columns (the shape replace_meal_log_ingredients() takes). */
export function ingredientDetails(draft: Pick<MealDraft, 'dishes'>) {
  let position = 0;
  return draft.dishes.flatMap((dish) =>
    dish.ingredients.map((ing) => ({
      dish_name:        dish.dish_name,
      dish_key:         normalizeDishKey(dish.dish_name),
      position:         position++,
      name:             ing.name,
      quantity_g:       ing.quantity_g,
      quantity_source:  ing.quantity_source,
      // Rows the user typed are their own value, not a model guess.
      confidence_score: ing.quantity_source === 'user' || dish.source !== 'model' ? null : dish.confidence_score,
      confidence_level: ing.quantity_source === 'user' ? 'high' : dish.confidence_level,
    })),
  );
}

export function ingredientRows(mealId: string, userId: string, draft: Pick<MealDraft, 'dishes'>) {
  return ingredientDetails(draft).map((row) => ({ meal_log_id: mealId, user_id: userId, ...row }));
}

export async function saveMealV2(
  supabase: SupabaseClient,
  userId: string,
  draft: MealDraft,
): Promise<{ ok: true; mealId: string } | { ok: false; error: string; duplicate?: boolean }> {
  const saved = await saveMealLogToDb({
    log_text:             draft.log_text,
    meal_type:            draft.meal_type,
    eaten_at:             draft.eaten_at,
    shared:               draft.is_shared,
    coEaterIds:           draft.co_eater_ids ?? 'all',
    nutrition:            draft.nutrition,
    inferred_ingredients: inferredIngredientStrings(draft),
    log_pipeline:         'v2',
    is_estimated:         true,
    ai_run_id:            draft.run_id,
    writeDetails: async (mealId) => {
      const { error } = await supabase.from('meal_log_ingredients').insert(ingredientRows(mealId, userId, draft));
      return error?.message ?? null;
    },
  });
  if (!saved.success || typeof saved.meal_id !== 'string') {
    return { ok: false, error: String(saved.error ?? 'Could not save the meal.'), duplicate: saved.duplicate === true };
  }
  return { ok: true, mealId: saved.meal_id };
}

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { MealNutrition } from '@/lib/ai/nutrition-schemas';
import type { ResolvedLogFields } from '@/lib/ai/log-context';

export interface MealToSave extends ResolvedLogFields {
  nutrition: MealNutrition;
  inferred_ingredients?: string[];
  /** Chat pipeline that produced the meal; null/absent for form logs. */
  log_pipeline?: 'v1' | 'v2' | null;
  /** True when quantities are estimates (v2). */
  is_estimated?: boolean;
  /** The v2 run that produced the meal. Unique: a second save of the same draft fails as a duplicate. */
  ai_run_id?: string | null;
  /**
   * Writes rows that belong to the meal (v2 ingredients) right after it is
   * inserted. If it returns an error, the meal is removed before anything else
   * (co-eaters, planned-meal override) is touched.
   */
  writeDetails?: (mealId: string) => Promise<string | null>;
}

export type SaveMealLog = (meal: MealToSave) => Promise<Record<string, unknown>>;

// ---------------------------------------------------------------------------
// saveMealLog — the single write path for a logged meal.
// Household and co-eaters are resolved here from the database, never taken
// from the model, so a meal can only be shared with real co-members.
// ---------------------------------------------------------------------------
export const saveMealLogToDb: SaveMealLog = async (meal) => {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { success: false, error: 'Unauthorized' };

  let householdId: string | null = null;
  let coEaters: string[] = [];
  if (meal.shared) {
    const { data: membership } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (membership) {
      householdId = membership.household_id as string;
      const { data: members } = await supabase
        .from('household_members')
        .select('user_id')
        .eq('household_id', householdId)
        .eq('status', 'active')
        .neq('user_id', user.id);

      const memberIds = (members ?? [])
        .map((m) => m.user_id as string | null)
        .filter((id): id is string => Boolean(id));
      const requested = meal.coEaterIds;
      coEaters = requested === 'all'
        ? memberIds
        : requested.filter((id) => memberIds.includes(id));
    }
  }
  // A meal can only be shared inside a household.
  const shared = meal.shared && householdId !== null;

  // Insert the meal log
  const { data, error } = await supabase
    .from('meal_logs')
    .insert({
      user_id: user.id,
      log_text: meal.log_text,
      meal_type: meal.meal_type,
      eaten_at: meal.eaten_at,
      nutrition: meal.nutrition,
      inferred_ingredients: meal.inferred_ingredients ?? null,
      log_pipeline: meal.log_pipeline ?? null,
      is_estimated: meal.is_estimated ?? false,
      ai_run_id: meal.ai_run_id ?? null,
      is_shared: shared,
      household_id: shared ? householdId : null,
    })
    .select('id')
    .single();

  if (error) {
    // 23505: this run's meal already exists (meal_logs_ai_run_id_key).
    if (error.code === '23505' && meal.ai_run_id) return { success: false, duplicate: true, error: 'Meal already saved.' };
    return { success: false, error: error.message };
  }

  if (meal.writeDetails) {
    const detailsError = await meal.writeDetails(data.id as string);
    if (detailsError) {
      await supabase.from('meal_logs').delete().eq('id', data.id).eq('user_id', user.id);
      return { success: false, error: detailsError };
    }
  }

  // Insert co-eater participant rows for shared meals
  const participants: string[] = [];
  if (shared && coEaters.length > 0) {
    const rows = coEaters.map((uid) => ({ meal_log_id: data.id, user_id: uid }));
    const { error: pError } = await supabase.from('meal_participants').insert(rows);
    if (!pError) participants.push(...coEaters);
  }

  // Search for an existing recipe by name similarity (ilike on most distinctive word)
  const words = meal.log_text.split(/\s+/);
  const keyword = words.find(w => w.length > 4) ?? words[0];
  const { data: match } = await supabase
    .from('recipes')
    .select('id, name, ingredients')
    .eq('user_id', user.id)
    .ilike('name', `%${keyword}%`)
    .limit(1)
    .maybeSingle();

  // Auto-clear any active plan for this slot
  const mealDate = meal.eaten_at.split('T')[0];
  await supabase
    .from('planned_meals')
    .update({ status: 'overridden', overridden_meal_id: data.id })
    .eq('user_id', user.id)
    .eq('meal_type', meal.meal_type)
    .eq('planned_date', mealDate)
    .eq('status', 'planned');

  revalidatePath('/dashboard');
  return {
    success: true,
    meal_id: data.id as string,
    meal_type: meal.meal_type,
    nutrition: meal.nutrition,
    is_shared: shared,
    participants,
    recipe_suggestion: match ?? null,
  };
};

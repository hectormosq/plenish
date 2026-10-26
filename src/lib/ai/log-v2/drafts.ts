import type { SupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { estimateCost, getAIModel, getModelName } from '@/lib/ai/provider';
import { getRun, updateRun } from '@/lib/ai/runs';
import type { RunStep } from '@/lib/ai/runs';
import { normalizeDishKey } from './dish-key';
import { dishLevel, mealLevel } from './gate';
import { nutritionNode } from './nutrition';
import { draftSnapshot } from './pipeline';
import type { DraftSnapshot } from './pipeline';
import { ingredientDetails, inferredIngredientStrings, saveMealV2 } from './save';
import { MealDraftSchema } from './schemas';
import type { DraftDish, MealDraft } from './schemas';

// ---------------------------------------------------------------------------
// Confirming and correcting v2 drafts. Shared by the Server Actions (table
// buttons) and the chat route (the `revise` intent). The draft comes from the
// browser, so it is validated and every derived field is recomputed here.
// A saved meal is only rewritten on an explicit confirmation (AI rule 8).
// ---------------------------------------------------------------------------

export type DraftError = 'unauthorized' | 'invalid' | 'not_found' | 'already_saved' | 'db';
export type DraftResult = { ok: true; draft: MealDraft } | { ok: false; error: DraftError };

function sameName(a: string, b: string): boolean {
  return normalizeDishKey(a) === normalizeDishKey(b);
}

/**
 * Marks rows that differ from the reference (what the pipeline produced, or
 * what is stored) as the user's own, and recomputes keys and levels.
 */
export function reconcile(draft: MealDraft, reference: DraftSnapshot): { draft: MealDraft; changed: boolean } {
  let changed = draft.dishes.length !== reference.length;

  const dishes: DraftDish[] = draft.dishes.map((dish) => {
    const ref = reference.find((r) => sameName(r.dish_name, dish.dish_name));
    if (!ref || ref.ingredients.length !== dish.ingredients.length) changed = true;

    const ingredients = dish.ingredients.map((ing) => {
      const original = ref?.ingredients.find((r) => sameName(r.name, ing.name));
      if (original && original.quantity_g === ing.quantity_g) {
        return { ...ing, quantity_source: original.quantity_source };
      }
      changed = true;
      return { ...ing, quantity_source: 'user' as const };
    });

    const allUser = ingredients.every((i) => i.quantity_source === 'user');
    const source = !ref || allUser ? 'user' : dish.source;
    const score = source === 'model' ? dish.confidence_score : null;
    return {
      ...dish,
      dish_key: normalizeDishKey(dish.dish_name),
      source,
      confidence_score: score,
      confidence_level: dishLevel(source, score),
      ingredients,
    };
  });

  return {
    draft: { ...draft, dishes, meal_level: mealLevel(dishes.map((d) => d.confidence_level)) },
    changed,
  };
}

async function currentUserId(supabase: SupabaseClient): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** What the pipeline showed for this run (its 'draft' step). */
function pipelineSnapshot(steps: RunStep[]): DraftSnapshot | null {
  const step = [...steps].reverse().find((s) => s.name === 'draft');
  return (step?.summary?.dishes as DraftSnapshot | undefined) ?? null;
}

/** The ingredient rows stored for a saved meal, grouped by dish. */
async function storedSnapshot(supabase: SupabaseClient, mealId: string): Promise<DraftSnapshot | null> {
  const { data, error } = await supabase
    .from('meal_log_ingredients')
    .select('dish_name, name, quantity_g, quantity_source, position')
    .eq('meal_log_id', mealId)
    .order('position');
  if (error || !data || data.length === 0) return null;

  const dishes: DraftSnapshot = [];
  for (const row of data as { dish_name: string; name: string; quantity_g: number | string; quantity_source: DraftDish['ingredients'][number]['quantity_source'] }[]) {
    let dish = dishes.find((d) => d.dish_name === row.dish_name);
    if (!dish) dishes.push((dish = { dish_name: row.dish_name, ingredients: [] }));
    dish.ingredients.push({ name: row.name, quantity_g: Number(row.quantity_g), quantity_source: row.quantity_source });
  }
  return dishes;
}

async function recomputeNutrition(supabase: SupabaseClient, userId: string, draft: MealDraft) {
  const { output, usage } = await nutritionNode.run(
    { dishes: draft.dishes },
    { model: getAIModel(), supabase, userId, tzOffsetMinutes: 0, now: new Date() },
  );
  return { nutrition: output.meal, usage };
}

export async function addSteps(supabase: SupabaseClient, runId: string, extra: RunStep[], patch: Parameters<typeof updateRun>[2]) {
  const run = await getRun(supabase, runId);
  const steps = [...(run?.steps ?? []), ...extra];
  const input = steps.reduce((n, s) => n + s.input_tokens, 0);
  const output = steps.reduce((n, s) => n + s.output_tokens, 0);
  const cost = estimateCost(run?.model ?? getModelName(), input, output);
  await updateRun(supabase, runId, { ...patch, steps, input_tokens: input, output_tokens: output, est_cost_usd: cost });
}

/** Saves a pending draft (button "Guardar" or a chat "sí"). */
export async function confirmDraft(supabase: SupabaseClient, raw: unknown): Promise<DraftResult> {
  const userId = await currentUserId(supabase);
  if (!userId) return { ok: false, error: 'unauthorized' };

  const parsed = MealDraftSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  if (parsed.data.status === 'saved') {
    return parsed.data.changes_pending ? updateSavedMeal(supabase, parsed.data) : { ok: false, error: 'already_saved' };
  }

  // The run is telemetry and may be missing (its insert failed). Without it
  // there is no reference to detect edits, so the draft's own rows are kept and
  // the nutrition is recomputed rather than trusted.
  const run = await getRun(supabase, parsed.data.run_id);
  if (run?.meal_log_id) return { ok: false, error: 'already_saved' };

  const { draft, changed } = run
    ? reconcile(parsed.data, pipelineSnapshot(run.steps ?? []) ?? [])
    : { draft: reconcile(parsed.data, draftSnapshot(parsed.data)).draft, changed: true };

  const extraSteps: RunStep[] = [];
  let nutrition = draft.nutrition;
  if (changed) {
    const n = await recomputeNutrition(supabase, userId, draft);
    nutrition = n.nutrition;
    extraSteps.push(...n.usage);
  }
  const toSave: MealDraft = { ...draft, nutrition };

  // meal_logs.ai_run_id is unique: a concurrent confirm of the same draft fails here.
  const saved = await saveMealV2(supabase, userId, toSave);
  if (!saved.ok) return { ok: false, error: saved.duplicate ? 'already_saved' : 'db' };

  if (run) await addSteps(supabase, toSave.run_id, extraSteps, { meal_log_id: saved.mealId, outcome: 'saved', user_corrected: changed });
  revalidatePath('/dashboard');
  return { ok: true, draft: { ...toSave, status: 'saved', meal_id: saved.mealId, changes_pending: false } };
}

/** Rewrites the ingredients of a saved meal after the user confirmed the changes. */
export async function updateSavedMeal(supabase: SupabaseClient, raw: unknown): Promise<DraftResult> {
  const userId = await currentUserId(supabase);
  if (!userId) return { ok: false, error: 'unauthorized' };

  const parsed = MealDraftSchema.safeParse(raw);
  if (!parsed.success || parsed.data.status !== 'saved' || !parsed.data.meal_id) return { ok: false, error: 'invalid' };

  const mealId = parsed.data.meal_id;
  const { data: meal } = await supabase.from('meal_logs').select('id').eq('id', mealId).eq('user_id', userId).maybeSingle();
  if (!meal) return { ok: false, error: 'not_found' };

  const reference = (await storedSnapshot(supabase, mealId)) ?? [];
  const { draft, changed } = reconcile(parsed.data, reference);
  if (!changed) return { ok: true, draft: { ...draft, changes_pending: false } };

  const n = await recomputeNutrition(supabase, userId, draft);
  const updated: MealDraft = { ...draft, nutrition: n.nutrition, changes_pending: false };

  // One transaction: a failed insert keeps the old ingredients and nutrition.
  const { error } = await supabase.rpc('replace_meal_log_ingredients', {
    p_meal_id:   mealId,
    p_rows:      ingredientDetails(updated),
    p_nutrition: updated.nutrition,
    p_inferred:  inferredIngredientStrings(updated),
  });
  if (error) return { ok: false, error: 'db' };

  await addSteps(supabase, updated.run_id, n.usage, { user_corrected: true });
  revalidatePath('/dashboard');
  return { ok: true, draft: updated };
}

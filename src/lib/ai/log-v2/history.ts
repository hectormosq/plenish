import { NutritionSchema } from '@/lib/ai/nutrition-schemas';
import type { DraftIngredient } from './schemas';
import type { HistoryMatch, NodeContext, ParsedDish, PipelineNode } from './types';

// ---------------------------------------------------------------------------
// history — reuses the user's latest v2 log of the same dish (by dish_key).
// Code only, no model call. Similarity matching is a follow-up (#70).
// ---------------------------------------------------------------------------

interface IngredientRow {
  meal_log_id: string;
  dish_key: string;
  name: string;
  quantity_g: number | string;
  position: number;
  created_at: string;
  meal_logs: { eaten_at: string; nutrition: unknown } | null;
}

const LOOKUP_LIMIT = 400;

export const historyNode: PipelineNode<{ dishes: ParsedDish[] }, { matches: Map<string, HistoryMatch> }> = {
  name: 'history',
  async run({ dishes }, ctx: NodeContext) {
    const started = Date.now();
    const matches = new Map<string, HistoryMatch>();
    const keys = [...new Set(dishes.map((d) => d.dish_key))];

    if (keys.length > 0) {
      const { data, error } = await ctx.supabase
        .from('meal_log_ingredients')
        .select('meal_log_id, dish_key, name, quantity_g, position, created_at, meal_logs(eaten_at, nutrition)')
        .eq('user_id', ctx.userId)
        .in('dish_key', keys)
        .order('created_at', { ascending: false })
        .limit(LOOKUP_LIMIT);

      if (error) console.warn('History lookup failed; continuing without history.', error.message);
      const rows = (data ?? []) as unknown as IngredientRow[];

      // Rows are newest first: the first meal seen for a key is its latest log.
      const latestMeal = new Map<string, string>();
      for (const row of rows) if (!latestMeal.has(row.dish_key)) latestMeal.set(row.dish_key, row.meal_log_id);

      // Which earlier meals contained only one dish (their nutrition can be reused as is).
      const mealIds = [...new Set(latestMeal.values())];
      const dishCount = new Map<string, number>();
      if (mealIds.length > 0) {
        const { data: keysOfMeals } = await ctx.supabase
          .from('meal_log_ingredients')
          .select('meal_log_id, dish_key')
          .in('meal_log_id', mealIds);
        const perMeal = new Map<string, Set<string>>();
        for (const r of (keysOfMeals ?? []) as { meal_log_id: string; dish_key: string }[]) {
          if (!perMeal.has(r.meal_log_id)) perMeal.set(r.meal_log_id, new Set());
          perMeal.get(r.meal_log_id)!.add(r.dish_key);
        }
        for (const [id, set] of perMeal) dishCount.set(id, set.size);
      }

      for (const [key, mealId] of latestMeal) {
        const mealRows = rows
          .filter((r) => r.dish_key === key && r.meal_log_id === mealId)
          .sort((a, b) => a.position - b.position);
        if (mealRows.length === 0) continue;

        const ingredients: DraftIngredient[] = mealRows.map((r) => ({
          name: r.name,
          quantity_g: Number(r.quantity_g),
          quantity_source: 'history',
        }));
        const nutrition = NutritionSchema.safeParse(mealRows[0].meal_logs?.nutrition);
        matches.set(key, {
          meal_id: mealId,
          eaten_at: mealRows[0].meal_logs?.eaten_at ?? mealRows[0].created_at,
          ingredients,
          nutrition: nutrition.success ? nutrition.data : null,
          single_dish: dishCount.get(mealId) === 1,
        });
      }
    }

    return {
      output: { matches },
      usage: [{
        name: 'history',
        input_tokens: 0,
        output_tokens: 0,
        latency_ms: Date.now() - started,
        summary: { dishes: keys.length, history_hits: matches.size },
      }],
    };
  },
};

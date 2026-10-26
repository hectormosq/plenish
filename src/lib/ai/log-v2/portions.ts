import { DEFAULT_QUANTITY_G } from './config';
import { normalizeDishKey } from './dish-key';
import type { DraftIngredient, QuantitySource } from './schemas';
import type { ParsedDish, PipelineNode } from './types';

// ---------------------------------------------------------------------------
// portions — final grams per ingredient. Code only, no model call.
// Quantities the user stated win over standard portions and history values.
// This is the seam for exact-quantity input later (issue #72).
// ---------------------------------------------------------------------------

export interface PortionInput {
  name: string;
  quantity_g: number;
  /** Defaults to 'estimated' (a standard portion from the ingredients node). */
  quantity_source?: QuantitySource;
}

function sameIngredient(a: string, b: string): boolean {
  const ka = normalizeDishKey(a);
  const kb = normalizeDishKey(b);
  return ka === kb || ka.includes(kb) || kb.includes(ka);
}

function cleanGrams(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.round(value * 10) / 10 : DEFAULT_QUANTITY_G;
}

export function applyPortions(dish: ParsedDish, ingredients: PortionInput[]): DraftIngredient[] {
  const stated = dish.stated_quantities.filter((q) => Number.isFinite(q.grams) && q.grams > 0);
  const used = new Set<number>();

  const rows: DraftIngredient[] = ingredients.map((ing) => {
    const idx = stated.findIndex((q, i) => !used.has(i) && sameIngredient(q.name, ing.name));
    if (idx >= 0) {
      used.add(idx);
      return { name: ing.name, quantity_g: cleanGrams(stated[idx].grams), quantity_source: 'stated' };
    }
    return { name: ing.name, quantity_g: cleanGrams(ing.quantity_g), quantity_source: ing.quantity_source ?? 'estimated' };
  });

  // A stated quantity that matches no ingredient is still something the user ate.
  stated.forEach((q, i) => {
    if (!used.has(i)) rows.push({ name: q.name, quantity_g: cleanGrams(q.grams), quantity_source: 'stated' });
  });

  return rows;
}

export const portionsNode: PipelineNode<{ dish: ParsedDish; ingredients: PortionInput[] }, { ingredients: DraftIngredient[] }> = {
  name: 'portions',
  async run({ dish, ingredients }) {
    const started = Date.now();
    const rows = applyPortions(dish, ingredients);
    return {
      output: { ingredients: rows },
      usage: [{
        name: 'portions',
        input_tokens: 0,
        output_tokens: 0,
        latency_ms: Date.now() - started,
        summary: { dish: dish.dish_name, stated: rows.filter((r) => r.quantity_source === 'stated').length },
      }],
    };
  },
};

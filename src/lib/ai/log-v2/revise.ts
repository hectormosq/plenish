import { z } from 'zod';
import { MAX_DISHES, MAX_INGREDIENTS_PER_DISH } from './config';
import { reconcile } from './drafts';
import { normalizeDishKey } from './dish-key';
import { callStructured } from './llm';
import { draftSnapshot } from './pipeline';
import type { DraftDish, MealDraft } from './schemas';
import type { NodeContext, PipelineNode } from './types';

// ---------------------------------------------------------------------------
// revise — the user's chat reply to a meal table ("sí", "sin queso", "eran
// 200 g"). Called only after the router returned 'revise'. One model call.
// It never writes: for a saved meal an edit only sets changes_pending, and the
// meal is rewritten when the user confirms (AI rule 8).
// ---------------------------------------------------------------------------

const ReviseSchema = z.object({
  action: z.enum(['confirm', 'edit', 'cancel']).describe(
    'confirm: the user accepts the table as it is. edit: the user changes ingredients or amounts. cancel: the user does not want it logged or discards the changes.',
  ),
  dishes: z.array(z.object({
    dish_name: z.string(),
    ingredients: z.array(z.object({ name: z.string(), quantity_g: z.number() })),
  })).describe('For edit: the complete table after applying the change (keep unchanged rows as they are). Otherwise an empty list.'),
});

const SYSTEM = `A meal-tracking assistant showed the user a table of what they ate. Read the user's reply and decide what they want.
For an edit, return the whole table with the change applied: remove what they say was not there, add what was missing with a standard amount in grams, change the amounts they correct. Keep every other row exactly as it was, with the same name and grams.`;

export type ReviseAction = 'confirm' | 'edit' | 'cancel';

export const reviseNode: PipelineNode<{ draft: MealDraft; userText: string }, { action: ReviseAction; draft: MealDraft }> = {
  name: 'revise',
  async run({ draft, userText }, ctx: NodeContext) {
    const table = draft.dishes
      .map((d) => `${d.dish_name}:\n${d.ingredients.map((i) => `- ${i.name}: ${i.quantity_g} g`).join('\n')}`)
      .join('\n');

    const { output, usage } = await callStructured(ctx, 'revise', {
      system: SYSTEM,
      prompt: `Table:\n${table}\n\nUser reply: ${userText}`,
      schema: ReviseSchema,
    });

    if (output.action !== 'edit' || output.dishes.length === 0) {
      const action = output.action === 'edit' ? 'confirm' : output.action;
      return { output: { action, draft }, usage: [{ ...usage, summary: { action } }] };
    }

    // Rebuild the table from the model's version, keeping what we knew about each dish.
    const dishes: DraftDish[] = output.dishes.slice(0, MAX_DISHES).flatMap((d) => {
      const rows = d.ingredients
        .map((i) => ({ name: i.name.trim().slice(0, 120), quantity_g: Math.round(i.quantity_g * 10) / 10 }))
        .filter((i) => i.name && Number.isFinite(i.quantity_g) && i.quantity_g > 0)
        .slice(0, MAX_INGREDIENTS_PER_DISH);
      if (rows.length === 0) return [];
      const known = draft.dishes.find((k) => normalizeDishKey(k.dish_name) === normalizeDishKey(d.dish_name));
      const base: DraftDish = known ?? {
        dish_name: d.dish_name.trim().slice(0, 120),
        dish_key: normalizeDishKey(d.dish_name),
        source: 'user',
        confidence_score: null,
        confidence_level: 'high',
        history_eaten_at: null,
        ingredients: [],
      };
      return [{ ...base, ingredients: rows.map((r) => ({ ...r, quantity_source: 'estimated' as const })) }];
    });

    if (dishes.length === 0) {
      return { output: { action: 'confirm', draft }, usage: [{ ...usage, summary: { action: 'confirm' } }] };
    }

    // Rows that match the current table keep their source; changed ones become the user's.
    const { draft: edited, changed } = reconcile({ ...draft, dishes }, draftSnapshot(draft));
    const next: MealDraft = draft.status === 'saved' ? { ...edited, changes_pending: changed } : edited;
    return { output: { action: 'edit', draft: next }, usage: [{ ...usage, summary: { action: 'edit', changed } }] };
  },
};

import { beforeEach, describe, expect, it, vi } from 'vitest';

// drafts.ts imports server-only modules; reconcile itself is pure.
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/ai/runs', () => ({ getRun: vi.fn(), updateRun: vi.fn() }));
vi.mock('./save', async (importOriginal) => ({ ...(await importOriginal<typeof import('./save')>()), saveMealV2: vi.fn() }));
vi.mock('./nutrition', () => ({ nutritionNode: { run: vi.fn() } }));
vi.mock('@/lib/ai/provider', () => ({ estimateCost: () => 0, getAIModel: () => null, getModelName: () => 'test' }));

import type { SupabaseClient } from '@supabase/supabase-js';
import { getRun, updateRun } from '@/lib/ai/runs';
import { confirmDraft, reconcile } from './drafts';
import { nutritionNode } from './nutrition';
import { saveMealV2 } from './save';
import type { MealDraft } from './schemas';

const draft = (ingredients: MealDraft['dishes'][number]['ingredients'], dishName = 'Arepa catira'): MealDraft => ({
  version: 1,
  run_id: '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b',
  meal_id: null,
  status: 'pending',
  changes_pending: false,
  language: 'es',
  log_text: 'arepa catira',
  meal_type: 'lunch',
  eaten_at: '2026-10-19T12:30:00.000Z',
  is_shared: false,
  co_eater_ids: null,
  meal_level: 'medium',
  nutrition: { food_groups: ['hidratos'], protein_type: null, servings: {}, has_occasional_food: false, portion_confidence: 'estimated' },
  dishes: [{
    dish_name: dishName,
    dish_key: 'whatever the client sent',
    source: 'model',
    confidence_score: 0.8,
    confidence_level: 'medium',
    history_eaten_at: null,
    ingredients,
  }],
});

const reference = [{
  dish_name: 'Arepa catira',
  ingredients: [
    { name: 'Harina de maíz', quantity_g: 120, quantity_source: 'estimated' as const },
    { name: 'Queso', quantity_g: 40, quantity_source: 'estimated' as const },
  ],
}];

describe('reconcile', () => {
  it('keeps the original sources when nothing changed and recomputes the key', () => {
    const { draft: out, changed } = reconcile(draft(reference[0].ingredients), reference);
    expect(changed).toBe(false);
    expect(out.dishes[0].dish_key).toBe('arepa catira');
    expect(out.dishes[0].ingredients.map((i) => i.quantity_source)).toEqual(['estimated', 'estimated']);
    expect(out.meal_level).toBe('medium');
  });

  it('marks edited and added rows as the user\'s, even if the client claims otherwise', () => {
    const { draft: out, changed } = reconcile(draft([
      { name: 'Harina de maíz', quantity_g: 100, quantity_source: 'estimated' },
      { name: 'Queso', quantity_g: 40, quantity_source: 'estimated' },
      { name: 'Aguacate', quantity_g: 50, quantity_source: 'stated' },
    ]), reference);
    expect(changed).toBe(true);
    expect(out.dishes[0].ingredients.map((i) => i.quantity_source)).toEqual(['user', 'estimated', 'user']);
  });

  it('detects a removed row', () => {
    const { changed } = reconcile(draft([reference[0].ingredients[0]]), reference);
    expect(changed).toBe(true);
  });

  it('a dish the user rewrote entirely becomes high confidence', () => {
    const { draft: out } = reconcile(draft([{ name: 'Pan', quantity_g: 60, quantity_source: 'estimated' }]), reference);
    expect(out.dishes[0].source).toBe('user');
    expect(out.dishes[0].confidence_level).toBe('high');
    expect(out.meal_level).toBe('high');
  });
});

describe('confirmDraft', () => {
  const supabase = { auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) } } as unknown as SupabaseClient;
  const recomputed = { food_groups: ['proteinas'], protein_type: null, servings: {}, has_occasional_food: false, portion_confidence: 'estimated' as const };

  beforeEach(() => {
    vi.mocked(getRun).mockReset();
    vi.mocked(updateRun).mockReset();
    vi.mocked(saveMealV2).mockReset().mockResolvedValue({ ok: true, mealId: 'meal-1' });
    vi.mocked(nutritionNode.run).mockReset().mockResolvedValue({ output: { meal: recomputed }, usage: [] });
  });

  it('saves without the run row, keeping the rows and recomputing nutrition', async () => {
    vi.mocked(getRun).mockResolvedValue(null);
    const result = await confirmDraft(supabase, draft(reference[0].ingredients));
    expect(result.ok).toBe(true);
    const saved = vi.mocked(saveMealV2).mock.calls[0][2];
    expect(saved.dishes[0].ingredients.map((i) => i.quantity_source)).toEqual(['estimated', 'estimated']);
    expect(saved.nutrition).toEqual(recomputed);
    expect(updateRun).not.toHaveBeenCalled();
  });

  it('reports a duplicate save as already_saved', async () => {
    vi.mocked(getRun).mockResolvedValue(null);
    vi.mocked(saveMealV2).mockResolvedValue({ ok: false, error: 'Meal already saved.', duplicate: true });
    expect(await confirmDraft(supabase, draft(reference[0].ingredients))).toEqual({ ok: false, error: 'already_saved' });
  });

  it('does not save again when the run already has a meal', async () => {
    vi.mocked(getRun).mockResolvedValue({ id: 'run', steps: [], meal_log_id: 'meal-0' });
    expect(await confirmDraft(supabase, draft(reference[0].ingredients))).toEqual({ ok: false, error: 'already_saved' });
    expect(saveMealV2).not.toHaveBeenCalled();
  });
});

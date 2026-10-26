import { describe, expect, it } from 'vitest';
import { MealDraftSchema } from './schemas';

const validDraft = () => ({
  version: 1,
  run_id: '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b',
  meal_id: null,
  status: 'pending',
  language: 'es',
  log_text: 'almorcé una arepa catira',
  meal_type: 'lunch',
  eaten_at: '2026-10-19T12:30:00.000Z',
  meal_level: 'medium',
  nutrition: {
    food_groups: ['hidratos', 'proteinas'],
    protein_type: 'white_meat',
    servings: { grains: 1, meat: 1, dairy: 1 },
    has_occasional_food: false,
    portion_confidence: 'estimated',
  },
  dishes: [{
    dish_name: 'Arepa catira',
    dish_key: 'arepa catira',
    source: 'model',
    confidence_score: 0.8,
    confidence_level: 'medium',
    ingredients: [
      { name: 'Harina de maíz', quantity_g: 120, quantity_source: 'estimated' },
      { name: 'Pollo mechado', quantity_g: 60, quantity_source: 'estimated' },
    ],
  }],
});

describe('MealDraftSchema', () => {
  it('accepts a valid draft and fills defaults', () => {
    const parsed = MealDraftSchema.parse(validDraft());
    expect(parsed.changes_pending).toBe(false);
    expect(parsed.dishes[0].history_eaten_at).toBeNull();
  });

  it('rejects a dish without ingredients', () => {
    const d = validDraft();
    d.dishes[0].ingredients = [];
    expect(MealDraftSchema.safeParse(d).success).toBe(false);
  });

  it('rejects a non-uuid run id', () => {
    expect(MealDraftSchema.safeParse({ ...validDraft(), run_id: 'abc' }).success).toBe(false);
  });

  it('rejects zero or negative grams', () => {
    const d = validDraft();
    d.dishes[0].ingredients[0].quantity_g = 0;
    expect(MealDraftSchema.safeParse(d).success).toBe(false);
  });
});

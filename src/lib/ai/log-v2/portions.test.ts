import { describe, expect, it } from 'vitest';
import { applyPortions } from './portions';
import { DEFAULT_QUANTITY_G } from './config';
import type { ParsedDish } from './types';

const dish = (stated: { name: string; grams: number }[] = []): ParsedDish => ({
  dish_name: 'Entrecot con ensalada',
  dish_key: 'entrecot con ensalada',
  stated_quantities: stated,
  listed_ingredients: [],
});

describe('applyPortions', () => {
  it('keeps standard portions as estimated', () => {
    const rows = applyPortions(dish(), [{ name: 'Entrecot', quantity_g: 250 }]);
    expect(rows).toEqual([{ name: 'Entrecot', quantity_g: 250, quantity_source: 'estimated' }]);
  });

  it('overrides with the stated quantity, matching names loosely', () => {
    const rows = applyPortions(dish([{ name: 'entrecot', grams: 300 }]), [
      { name: 'Entrecot de ternera', quantity_g: 250 },
      { name: 'Lechuga', quantity_g: 50 },
    ]);
    expect(rows[0]).toEqual({ name: 'Entrecot de ternera', quantity_g: 300, quantity_source: 'stated' });
    expect(rows[1].quantity_source).toBe('estimated');
  });

  it('stated quantities also win over history rows', () => {
    const rows = applyPortions(dish([{ name: 'pollo', grams: 200 }]), [
      { name: 'Pollo mechado', quantity_g: 60, quantity_source: 'history' },
      { name: 'Queso', quantity_g: 40, quantity_source: 'history' },
    ]);
    expect(rows.map((r) => r.quantity_source)).toEqual(['stated', 'history']);
    expect(rows[0].quantity_g).toBe(200);
  });

  it('replaces non-positive or missing grams with the default', () => {
    const rows = applyPortions(dish(), [
      { name: 'Sal', quantity_g: 0 },
      { name: 'Aceite', quantity_g: Number.NaN },
    ]);
    expect(rows.map((r) => r.quantity_g)).toEqual([DEFAULT_QUANTITY_G, DEFAULT_QUANTITY_G]);
  });

  it('adds a stated quantity that matches no ingredient', () => {
    const rows = applyPortions(dish([{ name: 'pan', grams: 40 }]), [{ name: 'Entrecot', quantity_g: 250 }]);
    expect(rows).toContainEqual({ name: 'pan', quantity_g: 40, quantity_source: 'stated' });
  });
});

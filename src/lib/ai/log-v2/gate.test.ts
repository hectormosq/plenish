import { describe, expect, it } from 'vitest';
import { decide, dishLevel, mealLevel } from './gate';
import type { ParsedDish } from './types';

const parsed = (dish_name: string): ParsedDish => ({ dish_name, dish_key: dish_name, stated_quantities: [], listed_ingredients: [] });

describe('dishLevel', () => {
  it('applies the 0.85 / 0.50 thresholds to model scores', () => {
    expect(dishLevel('model', 0.85)).toBe('high');
    expect(dishLevel('model', 0.849)).toBe('medium');
    expect(dishLevel('model', 0.5)).toBe('medium');
    expect(dishLevel('model', 0.499)).toBe('low');
    expect(dishLevel('model', null)).toBe('low');
  });

  it('treats history and user-listed dishes as high', () => {
    expect(dishLevel('history', null)).toBe('high');
    expect(dishLevel('user', 0.1)).toBe('high');
  });
});

describe('mealLevel', () => {
  it('is the lowest level of its dishes', () => {
    expect(mealLevel(['high', 'medium'])).toBe('medium');
    expect(mealLevel(['high', 'low', 'medium'])).toBe('low');
    expect(mealLevel(['high'])).toBe('high');
    expect(mealLevel([])).toBe('low');
  });
});

describe('decide', () => {
  it('saves high, confirms medium and asks about the low dish', () => {
    expect(decide([{ parsed: parsed('tortilla'), confidence_level: 'high' }]).action).toBe('save');
    expect(decide([
      { parsed: parsed('tortilla'), confidence_level: 'high' },
      { parsed: parsed('arepa catira'), confidence_level: 'medium' },
    ]).action).toBe('confirm');

    const ask = decide([
      { parsed: parsed('tortilla'), confidence_level: 'high' },
      { parsed: parsed('xyzzy de la abuela'), confidence_level: 'low' },
    ]);
    expect(ask).toEqual({ meal_level: 'low', action: 'ask', askAbout: 'xyzzy de la abuela' });
  });
});

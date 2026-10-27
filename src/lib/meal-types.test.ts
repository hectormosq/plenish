import { describe, expect, it } from 'vitest';
import { mealTypeForHour } from './meal-types';
import { parseMessagePrefixes } from './ai/intent-classifier';

describe('mealTypeForHour', () => {
  it.each([
    [8, 'breakfast'],
    [11, 'mid_morning_snack'],
    [12, 'mid_morning_snack'],
    [14, 'lunch'],
    [16, 'lunch'],
    [18, 'afternoon_snack'],
    [21, 'dinner'],
  ] as const)('maps %i:00 to %s', (hour, slot) => expect(mealTypeForHour(hour)).toBe(slot));
});

describe('parseMessagePrefixes', () => {
  it('reads a snack slot prefix', () => {
    const parsed = parseMessagePrefixes('[mid_morning_snack] una manzana');
    expect(parsed.prefixes.mealType).toBe('mid_morning_snack');
    expect(parsed.cleanText).toBe('una manzana');
  });

  it('ignores the old snack prefix as a meal type', () => {
    expect(parseMessagePrefixes('[snack] una manzana').prefixes.mealType).toBeUndefined();
  });
});

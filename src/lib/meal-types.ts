import { z } from 'zod';

/** Meal slots in the order they happen during the day (Spanish meal habits). */
export const MEAL_TYPES = [
  'breakfast',
  'mid_morning_snack',
  'lunch',
  'afternoon_snack',
  'dinner',
] as const;

export const MealTypeEnum = z.enum(MEAL_TYPES);
export type MealType = (typeof MEAL_TYPES)[number];

/**
 * Default meal slot for a local hour. Cut-offs fall between the usual
 * windows: breakfast 07:30–09:30, mid-morning 11:00–11:45,
 * lunch 13:30–15:30, afternoon 17:30–18:30, dinner 20:30–22:00.
 */
export function mealTypeForHour(hour: number): MealType {
  if (hour < 10) return 'breakfast';
  if (hour < 13) return 'mid_morning_snack';
  if (hour < 17) return 'lunch';
  if (hour < 20) return 'afternoon_snack';
  return 'dinner';
}

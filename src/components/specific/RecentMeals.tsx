/**
 * @deprecated Replaced by MealCalendar + MealWeekGrid (Phase 2: 005-ui-weekly-calendar).
 * Kept for reference. Safe to delete after Phase 2 is verified.
 */
import React from 'react';
import { getRecentMeals } from '@/actions/meals';
import { RecentMealsList } from './RecentMealsList';

export async function RecentMeals() {
  const meals = await getRecentMeals();
  return <RecentMealsList meals={meals} />;
}

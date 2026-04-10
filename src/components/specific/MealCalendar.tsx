import React from 'react';
import { getCalendarMeals } from '@/actions/calendar';
import { MealWeekGrid } from '@/components/ui/MealWeekGrid';

const INITIAL_DAYS_BACK = 35; // covers current week + 4 full weeks of history

/**
 * Async server component — fetches personal + household meals for the
 * calendar and passes a merged, deduplicated list to MealWeekGrid.
 */
export async function MealCalendar() {
  const meals = await getCalendarMeals(INITIAL_DAYS_BACK);
  return <MealWeekGrid meals={meals} daysBack={INITIAL_DAYS_BACK} />;
}

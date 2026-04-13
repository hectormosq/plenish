import React from 'react';
import { getCalendarMeals } from '@/actions/calendar';
import { getPlannedMeals } from '@/actions/plans';
import { MealWeekGrid } from '@/components/ui/MealWeekGrid';

const INITIAL_DAYS_BACK = 35; // covers current week + 4 full weeks of history
const PLANNED_WEEKS_AHEAD = 8; // fetch up to 8 weeks of planned meals

/**
 * Async server component — fetches personal + household meals and pending
 * planned meals, then passes them to MealWeekGrid.
 */
export async function MealCalendar() {
  const today = new Date().toISOString().split('T')[0];
  const weeksAhead = new Date(Date.now() + PLANNED_WEEKS_AHEAD * 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  const [meals, plannedMeals] = await Promise.all([
    getCalendarMeals(INITIAL_DAYS_BACK),
    getPlannedMeals(today, weeksAhead),
  ]);

  return (
    <MealWeekGrid meals={meals} daysBack={INITIAL_DAYS_BACK} plannedMeals={plannedMeals} />
  );
}

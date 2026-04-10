import React from 'react';
import { getWeekMeals } from '@/actions/meals';
import { getHouseholdMeals } from '@/actions/households';
import { createClient } from '@/lib/supabase/server';
import { MealWeekGrid, type CalendarMeal } from '@/components/ui/MealWeekGrid';

/**
 * Async server component — fetches personal + household meals for the
 * current week and passes a merged, deduplicated list to MealWeekGrid.
 */
export async function MealCalendar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const currentUserId = user?.id ?? '';

  const [ownMeals, householdMeals] = await Promise.all([
    getWeekMeals(),
    getHouseholdMeals(50),
  ]);

  // Merge and deduplicate by ID.
  // Own meals (user logged them) → isOwn: true → can delete.
  // Co-member household meals → isOwn: false → can only dismiss.
  // User's own shared meals appear in both lists; the ownMeals pass wins.
  const byId = new Map<string, CalendarMeal>();

  for (const m of ownMeals) {
    byId.set(m.id, { ...m, isOwn: true });
  }

  for (const m of householdMeals) {
    if (!byId.has(m.id)) {
      byId.set(m.id, {
        ...m,
        isOwn: (m as { user_id: string }).user_id === currentUserId,
        meal_participants: (m as { meal_participants?: CalendarMeal['meal_participants'] }).meal_participants,
      });
    }
  }

  return <MealWeekGrid meals={Array.from(byId.values())} />;
}

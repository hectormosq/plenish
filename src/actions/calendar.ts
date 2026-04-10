'use server';

import { createClient } from '@/lib/supabase/server';
import type { CalendarMeal } from '@/components/ui/MealWeekGrid';

/**
 * Fetches and merges own meals + household shared meals for the calendar.
 * Called server-side on initial render and from the client when navigating
 * to weeks outside the initially loaded range.
 */
export async function getCalendarMeals(daysBack: number = 35): Promise<CalendarMeal[]> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return [];

  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

  // Fetch own meals
  const { data: ownData } = await supabase
    .from('meal_logs')
    .select('*')
    .eq('user_id', user.id)
    .gte('eaten_at', since)
    .order('eaten_at', { ascending: false });

  const ownMeals = (ownData ?? []) as CalendarMeal[];

  // Fetch household membership
  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  let householdMeals: CalendarMeal[] = [];

  if (membership) {
    const { data: hData } = await supabase
      .from('meal_logs')
      .select('*, meal_participants(user_id, dismissed)')
      .eq('is_shared', true)
      .eq('household_id', membership.household_id)
      .gte('eaten_at', since)
      .order('eaten_at', { ascending: false });

    householdMeals = (hData ?? []) as CalendarMeal[];
  }

  // Merge and deduplicate. Own meals win over household view of the same meal.
  const byId = new Map<string, CalendarMeal>();

  for (const m of ownMeals) {
    byId.set(m.id, { ...m, isOwn: true });
  }

  for (const m of householdMeals) {
    if (!byId.has(m.id)) {
      byId.set(m.id, { ...m, isOwn: m.user_id === user.id });
    }
  }

  return Array.from(byId.values());
}

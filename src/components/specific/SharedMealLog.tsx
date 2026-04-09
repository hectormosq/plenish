import React from 'react';
import { getHouseholdMeals } from '@/actions/households';
import { SharedMealLogList } from './SharedMealLogList';

/**
 * Async server component that fetches the household shared meal log
 * and passes it to SharedMealLogList. Returns null when user has no household.
 */
export async function SharedMealLog() {
  const meals = await getHouseholdMeals(20);

  // If user has no household, getHouseholdMeals returns []
  // We render nothing rather than an empty card — HouseholdPanel handles the "no household" state
  if (meals.length === 0) return null;

  return <SharedMealLogList meals={meals} />;
}

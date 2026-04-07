import React from 'react';
import { getRecentMeals } from '@/actions/meals';
import { RecentMealsList } from './RecentMealsList';

export async function RecentMeals() {
  const meals = await getRecentMeals();
  return <RecentMealsList meals={meals} />;
}

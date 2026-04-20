'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { MealType, MealLog } from '@/actions/meals';
import { generateSinglePlan, generateWeekPlan } from '@/lib/ai/getRecommendation';
import { getFullSystemPrompt } from '@/lib/ai/provider';

export interface PlannedMeal {
  id: string;
  user_id: string;
  meal_type: MealType;
  planned_date: string; // YYYY-MM-DD
  name: string;
  description: string | null;
  reason: string | null;
  ingredients: string[] | null;
  instructions: string | null;
  prep_time_minutes: number | null;
  estimated_calories: number | null;
  status: 'planned' | 'accepted' | 'dismissed' | 'overridden' | 'expired';
  accepted_meal_id: string | null;
  overridden_meal_id: string | null;
  created_at: string;
}

async function getTopRejectedMeals(userId: string, limit = 5): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('planned_meals')
    .select('name')
    .eq('user_id', userId)
    .in('status', ['dismissed', 'overridden'])
    .order('created_at', { ascending: false })
    .limit(50);

  if (!data || data.length === 0) return '';

  const counts: Record<string, number> = {};
  for (const row of data) {
    counts[row.name] = (counts[row.name] ?? 0) + 1;
  }

  const sorted = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit);

  if (sorted.length === 0) return '';
  return `Meals this user has previously dismissed or skipped: ${sorted
    .map(([name, count]) => `${name} (×${count})`)
    .join(', ')}.`;
}

export async function getPlannedMeals(weekStart: string, weekEnd: string): Promise<PlannedMeal[]> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return [];

  const { data, error } = await supabase
    .from('planned_meals')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'planned')
    .gte('planned_date', weekStart)
    .lte('planned_date', weekEnd)
    .order('planned_date', { ascending: true });

  if (error) {
    console.error('Error fetching planned meals:', error);
    return [];
  }

  return data as PlannedMeal[];
}

export async function planSingleSlot(mealType: MealType, date: string, sessionId?: string, ingredientHint?: string): Promise<PlannedMeal> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Unauthorized');

  const [{ data: recentData }, rejectedSummary, systemPrompt] = await Promise.all([
    supabase
      .from('meal_logs')
      .select('id, log_text, meal_type, eaten_at')
      .eq('user_id', user.id)
      .order('eaten_at', { ascending: false })
      .limit(10),
    getTopRejectedMeals(user.id),
    getFullSystemPrompt(0, user.id, supabase),
  ]);

  const recommendation = await generateSinglePlan(
    mealType,
    date,
    (recentData ?? []) as MealLog[],
    rejectedSummary,
    systemPrompt,
    sessionId,
    ingredientHint,
  );

  const { data, error } = await supabase
    .from('planned_meals')
    .insert({
      user_id: user.id,
      meal_type: mealType,
      planned_date: date,
      name: recommendation.name,
      description: recommendation.description,
      reason: recommendation.reason,
      ingredients: recommendation.ingredients,
      instructions: recommendation.instructions ?? null,
      prep_time_minutes: recommendation.prepTimeMinutes,
      estimated_calories: recommendation.estimatedCalories,
      status: 'planned',
    })
    .select()
    .single();

  if (error) throw new Error('Failed to save planned meal');

  revalidatePath('/dashboard');
  return data as PlannedMeal;
}

export async function planWeekSlots(
  slots: { mealType: MealType; date: string }[],
  sessionId?: string,
): Promise<PlannedMeal[]> {
  if (slots.length === 0) return [];

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Unauthorized');

  const [{ data: recentData }, rejectedSummary, systemPrompt] = await Promise.all([
    supabase
      .from('meal_logs')
      .select('id, log_text, meal_type, eaten_at')
      .eq('user_id', user.id)
      .order('eaten_at', { ascending: false })
      .limit(10),
    getTopRejectedMeals(user.id),
    getFullSystemPrompt(0, user.id, supabase),
  ]);

  const recommendations = await generateWeekPlan(
    slots,
    (recentData ?? []) as MealLog[],
    rejectedSummary,
    systemPrompt,
    sessionId,
  );

  const rows = slots.map((slot, i) => ({
    user_id: user.id,
    meal_type: slot.mealType,
    planned_date: slot.date,
    name: recommendations[i].name,
    description: recommendations[i].description ?? null,
    reason: recommendations[i].reason,
    ingredients: recommendations[i].ingredients ?? null,
    instructions: recommendations[i].instructions ?? null,
    prep_time_minutes: recommendations[i].prepTimeMinutes,
    estimated_calories: recommendations[i].estimatedCalories,
    status: 'planned' as const,
  }));

  const { data, error } = await supabase
    .from('planned_meals')
    .insert(rows)
    .select();

  if (error) throw new Error('Failed to save planned meals');

  revalidatePath('/dashboard');
  return data as PlannedMeal[];
}

export async function regenerateSlot(
  existingId: string,
  mealType: MealType,
  date: string,
  ingredientHint?: string,
): Promise<PlannedMeal> {
  console.log('Regenerating slot', { existingId, mealType, date });
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Unauthorized');

  await supabase
    .from('planned_meals')
    .update({ status: 'dismissed' })
    .eq('id', existingId)
    .eq('user_id', user.id);

  return planSingleSlot(mealType, date, undefined, ingredientHint);
}

export async function dismissPlannedMeal(id: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Unauthorized');

  const { error } = await supabase
    .from('planned_meals')
    .update({ status: 'dismissed' })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw new Error('Failed to dismiss planned meal');

  revalidatePath('/dashboard');
}

export async function acceptPlannedMeal(id: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Unauthorized');

  const { error } = await supabase
    .from('planned_meals')
    .update({ status: 'accepted' })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw new Error('Failed to accept planned meal');

  revalidatePath('/dashboard');
}

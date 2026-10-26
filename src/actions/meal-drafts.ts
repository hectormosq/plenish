'use server';

import { createClient } from '@/lib/supabase/server';
import { confirmDraft, updateSavedMeal } from '@/lib/ai/log-v2/drafts';
import type { DraftResult } from '@/lib/ai/log-v2/drafts';

/** Saves a pending v2 meal table (the table's Save button). */
export async function confirmMealDraft(draft: unknown): Promise<DraftResult> {
  const supabase = await createClient();
  return confirmDraft(supabase, draft);
}

/** Saves the user's confirmed changes to an already logged v2 meal (Save changes). */
export async function updateMealIngredients(draft: unknown): Promise<DraftResult> {
  const supabase = await createClient();
  return updateSavedMeal(supabase, draft);
}

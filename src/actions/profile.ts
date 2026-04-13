'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function getShareDefault(): Promise<'just-me' | 'all'> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 'all';

  const { data } = await supabase
    .from('user_diet_profiles')
    .select('preferences')
    .eq('user_id', user.id)
    .maybeSingle();

  const pref = (data?.preferences as { share_default?: string } | null)?.share_default;
  return pref === 'just-me' ? 'just-me' : 'all';
}

export async function updateShareDefault(value: 'just-me' | 'all'): Promise<{ success: true }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  // Fetch first so we merge rather than overwrite other preference keys
  const { data: existing } = await supabase
    .from('user_diet_profiles')
    .select('preferences')
    .eq('user_id', user.id)
    .maybeSingle();

  const current = (existing?.preferences as object) ?? {};
  const updated = { ...current, share_default: value };

  const { error } = await supabase
    .from('user_diet_profiles')
    .update({ preferences: updated })
    .eq('user_id', user.id);

  if (error) throw new Error('Failed to update share default.');

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return { success: true };
}

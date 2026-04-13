'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// Share default is stored in Supabase Auth user_metadata — no extra DB column needed.

export async function getShareDefault(): Promise<'just-me' | 'all'> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const pref = user?.user_metadata?.share_default;
  return pref === 'just-me' ? 'just-me' : 'all';
}

export async function updateShareDefault(value: 'just-me' | 'all'): Promise<{ success: true }> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Unauthorized');

  const { error } = await supabase.auth.updateUser({
    data: { share_default: value },
  });

  if (error) throw new Error('Failed to update share default.');

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return { success: true };
}

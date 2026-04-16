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

export async function getChatPanelSide(): Promise<'left' | 'right'> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const pref = user?.user_metadata?.chat_panel_side;
  return pref === 'left' ? 'left' : 'right';
}

export async function updateChatPanelSide(value: 'left' | 'right'): Promise<{ success: true }> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Unauthorized');

  const { error } = await supabase.auth.updateUser({
    data: { chat_panel_side: value },
  });

  if (error) throw new Error('Failed to update chat panel side.');

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function getChatPanelDefaultOpen(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.user_metadata?.chat_panel_default_open === true;
}

export async function updateChatPanelDefaultOpen(value: boolean): Promise<{ success: true }> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Unauthorized');

  const { error } = await supabase.auth.updateUser({
    data: { chat_panel_default_open: value },
  });

  if (error) throw new Error('Failed to update chat panel default open.');

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return { success: true };
}

'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getEffectivePipeline, isLogPipeline } from '@/lib/ai/log-v2/preferences';
import type { LogPipeline } from '@/lib/ai/log-v2/preferences';

// Spec: specs/045-ai-log-v2/contracts/server-actions.md. Shown on /settings.

export async function getPreferences(): Promise<{
  logPipeline: LogPipeline;
  effectivePipeline: LogPipeline;
  isDeveloper: boolean;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { logPipeline: 'v1', effectivePipeline: 'v1', isDeveloper: false };

  const [prefs, developer, effectivePipeline] = await Promise.all([
    supabase.from('user_preferences').select('log_pipeline').eq('user_id', user.id).maybeSingle(),
    supabase.from('developer_whitelist').select('user_id').eq('user_id', user.id).maybeSingle(),
    getEffectivePipeline(supabase, user.id),
  ]);

  const stored = prefs.data?.log_pipeline;
  return {
    logPipeline: isLogPipeline(stored) ? stored : 'v1',
    effectivePipeline,
    isDeveloper: !!developer.data,
  };
}

export async function setLogPipeline(
  value: LogPipeline,
): Promise<{ ok: true } | { ok: false; error: 'unauthorized' | 'shadow_requires_developer' | 'invalid' }> {
  if (!isLogPipeline(value)) return { ok: false, error: 'invalid' };

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false, error: 'unauthorized' };

  if (value === 'v2_shadow_v1') {
    const { data } = await supabase.from('developer_whitelist').select('user_id').eq('user_id', user.id).maybeSingle();
    if (!data) return { ok: false, error: 'shadow_requires_developer' };
  }

  const { error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: user.id, log_pipeline: value }, { onConflict: 'user_id' });

  // The DB trigger is the final guard for shadow mode.
  if (error) return { ok: false, error: error.message.includes('shadow_requires_developer') ? 'shadow_requires_developer' : 'invalid' };

  revalidatePath('/settings');
  return { ok: true };
}

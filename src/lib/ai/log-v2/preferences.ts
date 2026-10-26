import type { SupabaseClient } from '@supabase/supabase-js';

export type LogPipeline = 'v1' | 'v2' | 'v2_shadow_v1';

export const LOG_PIPELINES: readonly LogPipeline[] = ['v1', 'v2', 'v2_shadow_v1'];

export function isLogPipeline(value: unknown): value is LogPipeline {
  return typeof value === 'string' && (LOG_PIPELINES as readonly string[]).includes(value);
}

/**
 * The pipeline that handles this user's chat logs right now.
 * No preference row → v1. Shadow mode needs a developer whitelist row; without
 * one (e.g. the user was removed from the list) it falls back to v2.
 */
export async function getEffectivePipeline(supabase: SupabaseClient, userId: string): Promise<LogPipeline> {
  const [prefs, developer] = await Promise.all([
    supabase.from('user_preferences').select('log_pipeline').eq('user_id', userId).maybeSingle(),
    supabase.from('developer_whitelist').select('user_id').eq('user_id', userId).maybeSingle(),
  ]);

  const stored = prefs.data?.log_pipeline;
  const pipeline: LogPipeline = isLogPipeline(stored) ? stored : 'v1';
  if (pipeline === 'v2_shadow_v1' && !developer.data) return 'v2';
  return pipeline;
}

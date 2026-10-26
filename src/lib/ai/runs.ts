import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// ai_pipeline_runs — one row per pipeline execution on a meal-logging turn,
// used to compare logging v1 and v2 on cost, latency and quality.
// Telemetry must never break a chat turn: errors are logged, never thrown.
// ---------------------------------------------------------------------------

export interface RunStep {
  name: string;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  summary?: Record<string, unknown>;
}

export interface PipelineRun {
  /** Set by callers that need the id before the row exists (the v2 draft carries it). */
  id?: string;
  correlation_id: string;
  variant: 'v1' | 'v2';
  is_shadow?: boolean;
  intent?: 'log' | 'mixed' | 'form' | null;
  meal_log_id?: string | null;
  model?: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  est_cost_usd?: number | null;
  latency_ms?: number | null;
  steps?: RunStep[];
  confidence_score?: number | null;
  confidence_level?: 'high' | 'medium' | 'low' | null;
  outcome?: 'saved' | 'draft' | 'question' | 'error' | 'shadow' | null;
  confirmation_requested?: boolean;
  user_corrected?: boolean;
  error?: string | null;
}

/** Inserts a run for the authenticated user. Returns its id, or null when it could not be written. */
export async function insertRun(supabase: SupabaseClient, run: PipelineRun): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('ai_pipeline_runs')
    .insert({ ...run, user_id: user.id })
    .select('id')
    .single();

  if (error) {
    console.warn('Could not record AI pipeline run.', error.message);
    return null;
  }
  return data.id as string;
}

export async function updateRun(
  supabase: SupabaseClient,
  runId: string,
  patch: Partial<Omit<PipelineRun, 'correlation_id' | 'variant'>>,
): Promise<void> {
  const { error } = await supabase.from('ai_pipeline_runs').update(patch).eq('id', runId);
  if (error) console.warn('Could not update AI pipeline run.', error.message);
}

/** Reads a run of the authenticated user (RLS limits rows to their own). */
export async function getRun(supabase: SupabaseClient, runId: string) {
  const { data } = await supabase
    .from('ai_pipeline_runs')
    .select('id, steps, input_tokens, output_tokens, est_cost_usd, model, meal_log_id, outcome')
    .eq('id', runId)
    .maybeSingle();
  return data as (Pick<PipelineRun, 'input_tokens' | 'output_tokens' | 'est_cost_usd' | 'model' | 'meal_log_id' | 'outcome'> & { id: string; steps: RunStep[] }) | null;
}

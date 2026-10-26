import { tool } from 'ai';
import type { LanguageModel } from 'ai';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { runLogPipelineV2 } from '@/lib/ai/log-v2/pipeline';
import type { LogContext } from '@/lib/ai/log-context';

export interface LogV2ToolOptions {
  model: LanguageModel;
  tzOffsetMinutes: number;
  correlationId: string;
  startedAt: number;
  logContext?: LogContext | null;
}

/**
 * log_meal_v2 — the v2 logging pipeline as a tool, for the mixed agent
 * (a message that reports a meal and asks for something else).
 * The direct `log` path calls the pipeline without an agent.
 */
export function createLogMealV2Tool(options: LogV2ToolOptions) {
  return tool({
    description:
      'Record the meal the user reports. The app breaks it into ingredients and shows the user a table, ' +
      'so pass only the part of the message that describes the food eaten. Do not repeat the table in your reply.',
    inputSchema: z.object({
      meal_text: z.string().min(1).max(500)
        .describe('The words of the user that describe what they ate or drank, as written.'),
    }),
    execute: async ({ meal_text }) => {
      const supabase = await createClient();
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) return { success: false, error: 'Unauthorized' };

      const result = await runLogPipelineV2(
        { text: meal_text, correlationId: options.correlationId, intent: 'mixed', startedAt: options.startedAt, logContext: options.logContext },
        { model: options.model, supabase, userId: user.id, tzOffsetMinutes: options.tzOffsetMinutes, now: new Date() },
      );
      return {
        success: result.outcome === 'saved' || result.outcome === 'draft',
        outcome: result.outcome,
        reply: result.reply,
        runId: result.runId,
        meal_id: result.draft?.meal_id ?? null,
        draft: result.draft,
      };
    },
  });
}

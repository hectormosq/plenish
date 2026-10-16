import { stepCountIs } from 'ai';
import type { ToolSet } from 'ai';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getBaseSystemPrompt, getFullSystemPrompt } from '@/lib/ai/provider';
import { resolvePromptTier } from '@/lib/ai/intent-classifier';
import type { PromptTier } from '@/lib/ai/intent-classifier';
import { isFormLog } from '@/lib/ai/log-context';
import type { LogContext } from '@/lib/ai/log-context';
import { createMealTools } from '@/lib/ai/tools/meal-tools';
import type { SaveMealLog } from '@/lib/ai/tools/meal-tools';
import { createPlanMealsTool } from '@/lib/ai/tools/plan-tools';

export interface ChatTurnInput {
  /** Text of the last user message */
  lastUserText: string;
  logContext: LogContext | null;
  tzOffsetMinutes: number;
  userId: string;
  supabase: SupabaseClient;
  sessionId?: string;
  /** Replaces the meal write — used by the evals. */
  saveMealLog?: SaveMealLog;
}

export interface ChatTurn {
  tier: PromptTier;
  /** 'form' = the logging form supplied the meal type; 'chat' = free text */
  mode: 'form' | 'chat';
  intentSignals: string[];
  system: string;
  tools: ToolSet;
  maxSteps: number;
  /** Tool the model must call on its first step, when the intent is already known */
  forcedFirstTool?: string;
}

// Step limits: a log needs one tool call plus the confirmation reply.
const FORM_MAX_STEPS = 3;
const BASE_MAX_STEPS = 4;
const FULL_MAX_STEPS = 7;

/**
 * Decides everything about one chat turn except the model call itself:
 * which prompt, which tools, how many steps. Shared by the chat route and the evals.
 */
export async function buildChatTurn(input: ChatTurnInput): Promise<ChatTurn> {
  const { lastUserText, logContext, tzOffsetMinutes: tz, userId, supabase, sessionId } = input;
  const mealTools = createMealTools(tz, { logContext, saveMealLog: input.saveMealLog });

  // The form told us the user is logging — no need to guess the intent.
  if (isFormLog(logContext)) {
    return {
      tier: 'base',
      mode: 'form',
      intentSignals: [],
      system: await getBaseSystemPrompt(tz, userId, supabase, 'form'),
      tools: { log_meal: mealTools.formLogMealTool },
      maxSteps: FORM_MAX_STEPS,
      forcedFirstTool: 'log_meal',
    };
  }

  const { tier, signals } = resolvePromptTier(lastUserText);

  if (tier === 'base') {
    return {
      tier,
      mode: 'chat',
      intentSignals: signals,
      system: await getBaseSystemPrompt(tz, userId, supabase, 'chat'),
      tools: { log_meal: mealTools.logMealTool },
      maxSteps: BASE_MAX_STEPS,
    };
  }

  return {
    tier,
    mode: 'chat',
    intentSignals: signals,
    system: await getFullSystemPrompt(tz, userId, supabase),
    tools: {
      get_meals:         mealTools.getMealsTool,
      log_meal:          mealTools.logMealTool,
      save_recipe:       mealTools.saveRecipeTool,
      delete_meal:       mealTools.deleteMealTool,
      update_meal:       mealTools.updateMealTool,
      get_daily_summary: mealTools.getDailySummaryTool,
      plan_meals:        createPlanMealsTool(sessionId),
    },
    maxSteps: FULL_MAX_STEPS,
  };
}

/** Loop-control settings for streamText / generateText derived from a turn. */
export function turnLoopSettings(turn: ChatTurn) {
  const { forcedFirstTool } = turn;
  return {
    stopWhen: stepCountIs(turn.maxSteps),
    prepareStep: ({ stepNumber }: { stepNumber: number }) =>
      forcedFirstTool && stepNumber === 0
        ? { toolChoice: { type: 'tool' as const, toolName: forcedFirstTool } }
        : undefined,
  };
}

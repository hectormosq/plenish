import { stepCountIs } from 'ai';
import type { LanguageModel, ToolSet } from 'ai';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getBaseSystemPrompt, getFullSystemPrompt } from '@/lib/ai/provider';
import { getChatSystemPrompt, getManageSystemPrompt, getPlanSystemPrompt } from '@/lib/ai/agents';
import { routeMessage } from '@/lib/ai/router';
import type { Intent, RouteDecision } from '@/lib/ai/router';
import { isFormLog } from '@/lib/ai/log-context';
import type { LogContext } from '@/lib/ai/log-context';
import { createMealTools } from '@/lib/ai/tools/meal-tools';
import type { SaveMealLog } from '@/lib/ai/tools/meal-tools';
import { createPlanMealsTool } from '@/lib/ai/tools/plan-tools';

export interface ChatTurnInput {
  model: LanguageModel;
  /** Text of the last user message */
  lastUserText: string;
  /** Text of the assistant message before it, to interpret replies like "sí" */
  previousAssistantText?: string;
  logContext: LogContext | null;
  tzOffsetMinutes: number;
  userId: string;
  supabase: SupabaseClient;
  sessionId?: string;
  /** Replaces the meal write — used by the evals. */
  saveMealLog?: SaveMealLog;
}

/** Which agent handles the turn: a routed intent, or 'form' for the logging form. */
export type AgentId = Intent | 'form';

export interface ChatTurn {
  agent: AgentId;
  /** Null for form logs, which skip the router */
  route: RouteDecision | null;
  system: string;
  tools: ToolSet;
  maxSteps: number;
  /** Tool the model must call on its first step, when the intent is already known */
  forcedFirstTool?: string;
}

// Step limits: a log needs one tool call plus the confirmation reply.
const MAX_STEPS: Record<AgentId, number> = {
  form:   3,
  log:    4,
  manage: 5,
  plan:   6,
  chat:   1,
  mixed:  7,
};

/**
 * Decides everything about one chat turn except the final model call:
 * which agent, its prompt, its tools and its step limit.
 * Shared by the chat route and the evals.
 */
export async function buildChatTurn(input: ChatTurnInput): Promise<ChatTurn> {
  const { model, lastUserText, logContext, tzOffsetMinutes: tz, userId, supabase, sessionId } = input;
  const meal = createMealTools(tz, { logContext, saveMealLog: input.saveMealLog });

  // The form told us the user is logging — no routing needed.
  if (isFormLog(logContext)) {
    return {
      agent: 'form',
      route: null,
      system: await getBaseSystemPrompt(tz, userId, supabase, 'form'),
      tools: { log_meal: meal.formLogMealTool },
      maxSteps: MAX_STEPS.form,
      forcedFirstTool: 'log_meal',
    };
  }

  const route = await routeMessage(model, lastUserText, input.previousAssistantText);
  const base = { agent: route.intent, route, maxSteps: MAX_STEPS[route.intent] };

  switch (route.intent) {
    case 'log':
      return {
        ...base,
        system: await getBaseSystemPrompt(tz, userId, supabase, 'chat'),
        tools: { log_meal: meal.logMealTool },
      };

    case 'manage':
      return {
        ...base,
        system: getManageSystemPrompt(tz),
        tools: {
          get_meals:   meal.getMealsTool,
          update_meal: meal.updateMealTool,
          delete_meal: meal.deleteMealTool,
          save_recipe: meal.saveRecipeTool,
        },
      };

    case 'plan':
      return {
        ...base,
        system: await getPlanSystemPrompt(tz, userId, supabase),
        tools: {
          get_daily_summary: meal.getDailySummaryTool,
          plan_meals:        createPlanMealsTool(sessionId),
        },
      };

    case 'chat':
      return { ...base, system: getChatSystemPrompt(tz), tools: {} };

    case 'mixed':
      // One message doing two things: the general agent with every tool.
      return {
        ...base,
        system: await getFullSystemPrompt(tz, userId, supabase),
        tools: {
          get_meals:         meal.getMealsTool,
          log_meal:          meal.logMealTool,
          save_recipe:       meal.saveRecipeTool,
          delete_meal:       meal.deleteMealTool,
          update_meal:       meal.updateMealTool,
          get_daily_summary: meal.getDailySummaryTool,
          plan_meals:        createPlanMealsTool(sessionId),
        },
      };
  }
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

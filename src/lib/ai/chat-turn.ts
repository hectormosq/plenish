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
import type { LogPipeline } from '@/lib/ai/log-v2/preferences';
import { createPlanMealsTool } from '@/lib/ai/tools/plan-tools';
import { createLogMealV2Tool } from '@/lib/ai/tools/log-v2-tool';

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
  /** Route already decided by the caller; skips the router call. */
  route?: RouteDecision;
  /** Chat logging pipeline of the user. Defaults to v1. */
  logPipeline?: LogPipeline;
  /** Shared id of the runs on this message (v2 telemetry). */
  correlationId?: string;
  /** Request start, for end-to-end latency (v2 telemetry). */
  startedAt?: number;
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

  const route = input.route ?? await routeMessage(model, lastUserText, input.previousAssistantText);
  // 'revise' answers a v2 meal table and is handled by the chat route before any agent runs.
  if (route.intent === 'revise') throw new Error('The revise intent has no agent; handle it before buildChatTurn.');
  const intent = route.intent;
  const base = { agent: intent, route, maxSteps: MAX_STEPS[intent] };

  switch (intent) {
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

    case 'mixed': {
      // One message doing two things: the general agent with every tool.
      // v2 users log through the v2 pipeline; nothing else changes.
      const v2 = (input.logPipeline ?? 'v1') !== 'v1';
      const logTool: ToolSet = v2
        ? {
            log_meal_v2: createLogMealV2Tool({
              model,
              tzOffsetMinutes: tz,
              correlationId: input.correlationId ?? crypto.randomUUID(),
              startedAt: input.startedAt ?? Date.now(),
              logContext,
            }),
          }
        : { log_meal: meal.logMealTool };
      return {
        ...base,
        system: await getFullSystemPrompt(tz, userId, supabase, { logTool: v2 ? 'log_meal_v2' : 'log_meal' }),
        tools: {
          get_meals:         meal.getMealsTool,
          ...logTool,
          save_recipe:       meal.saveRecipeTool,
          delete_meal:       meal.deleteMealTool,
          update_meal:       meal.updateMealTool,
          get_daily_summary: meal.getDailySummaryTool,
          plan_meals:        createPlanMealsTool(sessionId),
        },
      };
    }
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

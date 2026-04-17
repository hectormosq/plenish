import { streamText, convertToModelMessages, stepCountIs, isTextUIPart } from 'ai';
import type { UIMessage } from 'ai';
import { getAIModel, getModelName, getBaseSystemPrompt, getFullSystemPrompt } from '@/lib/ai/provider';
import { parseMessagePrefixes, classifyIntent } from '@/lib/ai/intent-classifier';
import type { PromptTier } from '@/lib/ai/intent-classifier';
import { createClient } from '@/lib/supabase/server';
import { createMealTools } from '@/lib/ai/tools/meal-tools';
import { createPlanMealsTool } from '@/lib/ai/tools/plan-tools';
import { createServerWriter } from 'ai-session-logger/next/server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return new Response('Unauthorized', { status: 401 });

  const { messages, tzOffset, sessionId } = await req.json();
  const tz = Number.isFinite(tzOffset) ? tzOffset : 0;

  // ── Intent classification ─────────────────────────────────────────────────
  // Inspect the last user message to determine which prompt tier to use.
  const rawMessages = (messages ?? []) as UIMessage[];
  const lastUserMsg = [...rawMessages].reverse().find((m) => m.role === 'user');
  const textPart    = lastUserMsg?.parts.find(isTextUIPart);
  const rawContent  = textPart?.text ?? '';

  const { cleanText }       = parseMessagePrefixes(rawContent);
  const { intent, signals } = classifyIntent(cleanText);
  const tier: PromptTier    = intent === 'logging' ? 'base' : 'full';

  // ── Prompt selection ──────────────────────────────────────────────────────
  const model  = getAIModel();
  const system = tier === 'base'
    ? await getBaseSystemPrompt(tz, user.id, supabase)
    : await getFullSystemPrompt(tz, user.id, supabase);

  // ── Session telemetry ─────────────────────────────────────────────────────
  const writer = sessionId
    ? createServerWriter({ sessionId, userId: user.id, app: 'plenish' })
    : null;

  writer?.promptSent({
    model: getModelName(),
    prompt: system,
    tokensEst: Math.ceil((system.length + JSON.stringify(messages).length) / 4),
    context: {
      messageCount:  messages.length,
      promptTier:    tier,
      intentSignals: signals,
    },
  });

  // ── Tools + streaming ─────────────────────────────────────────────────────
  const {
    getMealsTool,
    logMealTool,
    saveRecipeTool,
    deleteMealTool,
    updateMealTool,
    getDailySummaryTool,
  } = createMealTools(tz);

  const converted = await convertToModelMessages(messages);

  const onStepFinish: NonNullable<Parameters<typeof streamText>[0]['onStepFinish']> = (
    { text, toolCalls, toolResults, usage },
  ) => {
    for (const tc of toolCalls) {
      writer?.toolCall(tc.toolName, tc.input as Record<string, unknown>);
    }
    for (const tr of toolResults) {
      writer?.toolResult(tr.toolName, tr.output);
    }
    if (text) {
      writer?.aiResponse({
        text,
        inputTokens:  usage.inputTokens,
        outputTokens: usage.outputTokens,
        tokensUsed:   usage.totalTokens,
      });
    }
  };

  // Split into two distinct streamText calls so TypeScript can infer each
  // tool set independently rather than widening to a union type.
  const result = tier === 'base'
    ? streamText({
        model,
        system,
        messages:     converted,
        tools:        { log_meal: logMealTool },
        stopWhen:     stepCountIs(7),
        onStepFinish,
      })
    : streamText({
        model,
        system,
        messages:     converted,
        tools:        {
          get_meals:         getMealsTool,
          log_meal:          logMealTool,
          save_recipe:       saveRecipeTool,
          delete_meal:       deleteMealTool,
          update_meal:       updateMealTool,
          get_daily_summary: getDailySummaryTool,
          plan_meals:        createPlanMealsTool(sessionId),
        },
        stopWhen:     stepCountIs(7),
        onStepFinish,
      });

  return result.toUIMessageStreamResponse();
}

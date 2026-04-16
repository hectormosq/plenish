import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import { getAIModel, getModelName, getSystemPrompt } from '@/lib/ai/provider';
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

  const model = getAIModel();
  const system = await getSystemPrompt(tz, user.id, supabase);

  // Server-side session writer — writes into the client's session via direct file transport
  const writer = sessionId
    ? createServerWriter({ sessionId, userId: user.id, app: 'plenish' })
    : null;

  writer?.promptSent({
    model: getModelName(),
    prompt: system,
    tokensEst: Math.ceil((system.length + JSON.stringify(messages).length) / 4),
    context: { messageCount: messages.length },
  });

  const {
    getMealsTool,
    logMealTool,
    saveRecipeTool,
    deleteMealTool,
    updateMealTool,
    getDailySummaryTool,
  } = createMealTools(tz);

  const result = streamText({
    model,
    system,
    messages: await convertToModelMessages(messages),
    tools: {
      get_meals:          getMealsTool,
      log_meal:           logMealTool,
      save_recipe:        saveRecipeTool,
      delete_meal:        deleteMealTool,
      update_meal:        updateMealTool,
      get_daily_summary:  getDailySummaryTool,
      plan_meals:         createPlanMealsTool(sessionId),
    },
    stopWhen: stepCountIs(7),
    onStepFinish: ({ toolCalls, toolResults }) => {
      for (const tc of toolCalls) {
        writer?.toolCall(tc.toolName, tc.input as Record<string, unknown>);
      }
      for (const tr of toolResults) {
        writer?.toolResult(tr.toolName, tr.output);
      }
    },
  });

  return result.toUIMessageStreamResponse();
}

import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import { getAIModel, getSystemPrompt } from '@/lib/ai/provider';
import { createClient } from '@/lib/supabase/server';
import { createMealTools } from '@/lib/ai/tools/meal-tools';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return new Response('Unauthorized', { status: 401 });

  const { messages, tzOffset } = await req.json();
  const tz = Number.isFinite(tzOffset) ? tzOffset : 0;

  const model = getAIModel();
  const { getMealsTool, logMealTool, saveRecipeTool, deleteMealTool, updateMealTool } =
    createMealTools(tz);

  const result = streamText({
    model,
    system: getSystemPrompt(tz),
    messages: await convertToModelMessages(messages),
    tools: {
      get_meals: getMealsTool,
      log_meal: logMealTool,
      save_recipe: saveRecipeTool,
      delete_meal: deleteMealTool,
      update_meal: updateMealTool,
    },
    stopWhen: stepCountIs(7),
  });

  return result.toUIMessageStreamResponse();
}

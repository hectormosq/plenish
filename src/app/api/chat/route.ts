import { streamText, convertToModelMessages } from 'ai';
import { getAIModel, SYSTEM_PROMPT } from '@/lib/ai/provider';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return new Response('Unauthorized', { status: 401 });

  const { messages } = await req.json();

  const model = getAIModel();

  const result = streamText({
    model,
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
  });

  // toUIMessageStreamResponse is the correct method for useChat in AI SDK v3
  return result.toUIMessageStreamResponse();
}

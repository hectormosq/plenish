import { streamText } from 'ai';
import { getAIModel, SYSTEM_PROMPT } from '@/lib/ai/provider';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const model = getAIModel();

  const result = streamText({
    model,
    system: SYSTEM_PROMPT,
    messages,
  });

  // toUIMessageStreamResponse is the correct method for useChat in AI SDK v3
  return result.toUIMessageStreamResponse();
}

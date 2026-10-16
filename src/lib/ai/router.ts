import { generateText, Output } from 'ai';
import type { LanguageModel } from 'ai';
import { z } from 'zod';
import { resolvePromptTier } from '@/lib/ai/intent-classifier';

// ---------------------------------------------------------------------------
// Intent router — one small structured-output call that decides which agent
// handles a free-text chat message. Form logs never reach it.
// ---------------------------------------------------------------------------

export const IntentEnum = z.enum(['log', 'manage', 'plan', 'chat', 'mixed']);
export type Intent = z.infer<typeof IntentEnum>;

const RouteSchema = z.object({
  intent: IntentEnum,
  reason: z.string().describe('A few words on why, for telemetry.'),
});

export interface RouteDecision {
  intent: Intent;
  reason: string;
  /** 'model' = router call succeeded; 'keyword' = fell back to the keyword classifier */
  source: 'model' | 'keyword';
}

const ROUTER_SYSTEM = `You route messages in a meal-tracking app to the right assistant. Classify the user's latest message.

- log: the user reports food or drink they ate or drank, so it can be recorded. Examples: "almorcé pollo con arroz", "two eggs and toast this morning", "merendamos fruta".
- manage: the user wants to see, correct, delete, or save past meals or recipes. Examples: "¿qué cené el martes?", "elimina la merienda", "remove yesterday's lunch", "guarda esa receta".
- plan: the user wants a meal recommendation, a meal plan, or to know how they are doing against their nutrition goals. Examples: "¿qué desayuno mañana?", "plan my dinners", "¿me falta verdura esta semana?".
- chat: anything else — greetings, thanks, general nutrition questions not about the user's own meals.
- mixed: one message that both reports food eaten AND asks for something else.

Mentioning food is not enough for "log": questions and requests about food are not reports of eating.
Use the previous assistant message only to interpret short replies such as "sí", "no" or "vale".`;

const PREVIOUS_MAX_CHARS = 500;

/** Maps the keyword classifier onto intents; used when the router call fails. */
export function keywordRoute(text: string): RouteDecision {
  const { intent, signals } = resolvePromptTier(text);
  const mapped: Intent =
    intent === 'logging' ? 'log'
    : intent === 'management' ? 'manage'
    : intent === 'recommendation' ? 'plan'
    : 'mixed';
  return { intent: mapped, reason: `keywords: ${signals.join(', ') || 'none'}`, source: 'keyword' };
}

export async function routeMessage(
  model: LanguageModel,
  userText: string,
  previousAssistantText?: string,
): Promise<RouteDecision> {
  const previous = previousAssistantText?.trim()
    ? `Previous assistant message: ${previousAssistantText.trim().slice(0, PREVIOUS_MAX_CHARS)}\n`
    : '';

  try {
    const { output } = await generateText({
      model,
      system: ROUTER_SYSTEM,
      prompt: `${previous}User message: ${userText}`,
      output: Output.object({ schema: RouteSchema }),
      temperature: 0,
      maxRetries: 1,
    });
    return { intent: output.intent, reason: output.reason, source: 'model' };
  } catch (err) {
    console.warn('Intent router failed; using keyword classifier.', err);
    return keywordRoute(userText);
  }
}

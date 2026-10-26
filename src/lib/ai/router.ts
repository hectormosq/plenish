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

/**
 * 'revise' is internal to the v2 logging pipeline: the user is answering a meal
 * table the assistant just showed. It is only offered while a draft is pending.
 */
export type RouteIntent = Intent | 'revise';

const RouteSchema = z.object({
  intent: IntentEnum,
  reason: z.string().describe('A few words on why, for telemetry.'),
});

const RouteWithReviseSchema = z.object({
  intent: z.enum([...IntentEnum.options, 'revise']),
  reason: z.string().describe('A few words on why, for telemetry.'),
});

export interface RouterUsage {
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export interface RouteDecision {
  intent: RouteIntent;
  reason: string;
  /** 'model' = router call succeeded; 'keyword' = fell back to the keyword classifier */
  source: 'model' | 'keyword';
  usage: RouterUsage;
}

export interface RouteOptions {
  /** True when the last assistant message shows a v2 meal table waiting for the user. */
  draftPending?: boolean;
}

const ROUTER_SYSTEM = `You route messages in a meal-tracking app to the right assistant. Classify the user's latest message.

- log: the user reports food or drink they ate or drank, so it can be recorded. Examples: "almorcé pollo con arroz", "two eggs and toast this morning", "merendamos fruta".
- manage: the user wants to see, correct, delete, or save past meals or recipes. Examples: "¿qué cené el martes?", "elimina la merienda", "remove yesterday's lunch", "guarda esa receta".
- plan: the user wants a meal recommendation, a meal plan, or to know how they are doing against their nutrition goals. Examples: "¿qué desayuno mañana?", "plan my dinners", "¿me falta verdura esta semana?".
- chat: anything else — greetings, thanks, general nutrition questions not about the user's own meals.
- mixed: one message that both reports food eaten AND asks for something else (a question or request besides the report). Reporting several foods, or a food you do not recognise, is still "log".

Mentioning food is not enough for "log": questions and requests about food are not reports of eating.
Use the previous assistant message only to interpret short replies such as "sí", "no" or "vale".`;

const REVISE_RULE = `

The previous assistant message showed a table of a meal for the user to check. Add this option:
- revise: the user answers about that meal — confirms it ("sí", "vale", "guárdalo", "ok"), corrects it ("sin queso", "eran 200 g de pollo", "añade aguacate", "it was rice, not pasta") or cancels it ("no lo guardes", "cancel"). A new meal or an unrelated request is not "revise".
- A message that reports eating ("cené…", "comí…", "desayuné…", "I had…") is a new meal: "log", even when it names the same dish as the table.`;

const PREVIOUS_MAX_CHARS = 500;
const NO_USAGE: RouterUsage = { inputTokens: 0, outputTokens: 0, latencyMs: 0 };

// Short replies about a pending meal table, matched on the start of the normalized message.
const REVISE_KEYWORDS = /^(si|vale|ok|okay|yes|no|sin|con|quita|quitale|anade|anadele|cambia|pon|eran|era|remove|add|change|save|guarda|guardalo|cancel|cancela)\b/;

function normalise(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '').trim();
}

/** Maps the keyword classifier onto intents; used when the router call fails. */
export function keywordRoute(text: string, options: RouteOptions = {}): RouteDecision {
  if (options.draftPending && REVISE_KEYWORDS.test(normalise(text))) {
    return { intent: 'revise', reason: 'keywords: reply to pending meal', source: 'keyword', usage: NO_USAGE };
  }
  const { intent, signals } = resolvePromptTier(text);
  const mapped: Intent =
    intent === 'logging' ? 'log'
    : intent === 'management' ? 'manage'
    : intent === 'recommendation' ? 'plan'
    : 'mixed';
  return { intent: mapped, reason: `keywords: ${signals.join(', ') || 'none'}`, source: 'keyword', usage: NO_USAGE };
}

export async function routeMessage(
  model: LanguageModel,
  userText: string,
  previousAssistantText?: string,
  options: RouteOptions = {},
): Promise<RouteDecision> {
  const previous = previousAssistantText?.trim()
    ? `Previous assistant message: ${previousAssistantText.trim().slice(0, PREVIOUS_MAX_CHARS)}\n`
    : '';
  const draftPending = options.draftPending === true;
  const started = Date.now();

  try {
    const { output, usage } = await generateText({
      model,
      system: draftPending ? ROUTER_SYSTEM + REVISE_RULE : ROUTER_SYSTEM,
      prompt: `${previous}User message: ${userText}`,
      output: Output.object({ schema: draftPending ? RouteWithReviseSchema : RouteSchema }),
      temperature: 0,
      maxRetries: 1,
    });
    return {
      intent: output.intent,
      reason: output.reason,
      source: 'model',
      usage: {
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
        latencyMs: Date.now() - started,
      },
    };
  } catch (err) {
    console.warn('Intent router failed; using keyword classifier.', err);
    return keywordRoute(userText, options);
  }
}

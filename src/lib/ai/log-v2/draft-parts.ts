import type { UIMessage } from 'ai';
import { MealDraftSchema } from './schemas';
import type { MealDraft } from './schemas';

// Finding meal tables inside chat messages. Pure — used by the chat route and the chat UI.
// A table arrives either as a `data-meal-draft` part (direct log path) or as the
// output of the `log_meal_v2` tool (mixed agent).

export function draftOfPart(part: UIMessage['parts'][number]): MealDraft | null {
  if (part.type === 'data-meal-draft') {
    const parsed = MealDraftSchema.safeParse((part as { data?: unknown }).data);
    return parsed.success ? parsed.data : null;
  }
  if (part.type === 'tool-log_meal_v2') {
    const tool = part as { state?: string; output?: { draft?: unknown } };
    if (tool.state !== 'output-available') return null;
    const parsed = MealDraftSchema.safeParse(tool.output?.draft);
    return parsed.success ? parsed.data : null;
  }
  return null;
}

/** The last valid meal table in a message, if any. */
export function latestDraftIn(message: UIMessage | undefined): MealDraft | null {
  if (!message) return null;
  for (const part of [...message.parts].reverse()) {
    const draft = draftOfPart(part);
    if (draft) return draft;
  }
  return null;
}

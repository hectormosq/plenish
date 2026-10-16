import { z } from 'zod';

export const MealTypeEnum = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);
export type MealTypeValue = z.infer<typeof MealTypeEnum>;

// ---------------------------------------------------------------------------
// LogContext — values the logging form already knows.
// Sent as request fields next to the chat messages, never parsed out of text,
// and applied server-side so the model cannot get them wrong.
// ---------------------------------------------------------------------------
export const LogContextSchema = z.object({
  mealType:   MealTypeEnum.nullish(),
  date:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish()
    .describe('Local day the meal was eaten. Absent means today.'),
  shareState: z.enum(['all', 'partial', 'just-me']).nullish(),
  coEaterIds: z.array(z.uuid()).max(20).nullish()
    .describe('Selected co-eaters when shareState is "partial".'),
});

export type LogContext = z.infer<typeof LogContextSchema>;

/** Returns the validated context, or null when the request carried none or it was malformed. */
export function parseLogContext(raw: unknown): LogContext | null {
  if (raw === undefined || raw === null) return null;
  const parsed = LogContextSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** True when the form supplied the meal type, i.e. the user is explicitly logging a meal. */
export function isFormLog(ctx: LogContext | null): ctx is LogContext & { mealType: MealTypeValue } {
  return Boolean(ctx?.mealType);
}

export interface ModelLogFields {
  log_text: string;
  meal_type?: MealTypeValue;
  eaten_at?: string;
  is_shared?: boolean;
}

export interface ResolvedLogFields {
  log_text: string;
  meal_type: MealTypeValue;
  /** ISO 8601 timestamp */
  eaten_at: string;
  shared: boolean;
  /** 'all' = every active co-member of the logger's household */
  coEaterIds: string[] | 'all';
}

/**
 * Merges what the model inferred with what the form already knew.
 * Form values always win; the model's values are only a fallback.
 */
export function resolveLogFields(
  input: ModelLogFields,
  ctx: LogContext | null,
  nowISO: string,
): ResolvedLogFields {
  const meal_type = ctx?.mealType ?? input.meal_type;
  if (!meal_type) throw new Error('meal_type is required when the form did not provide one.');

  let eaten_at = nowISO;
  if (ctx?.date) {
    eaten_at = `${ctx.date}T12:00:00.000Z`;
  } else if (input.eaten_at && !Number.isNaN(Date.parse(input.eaten_at))) {
    eaten_at = new Date(input.eaten_at).toISOString();
  }

  const shared = ctx?.shareState ? ctx.shareState !== 'just-me' : (input.is_shared ?? false);
  const coEaterIds = ctx?.shareState === 'partial' ? (ctx.coEaterIds ?? []) : 'all';

  return { log_text: input.log_text.trim(), meal_type, eaten_at, shared, coEaterIds };
}

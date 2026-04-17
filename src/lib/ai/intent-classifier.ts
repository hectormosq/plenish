// ─── Types (T001) ──────────────────────────────────────────────────────────

export type MessageIntent = 'logging' | 'management' | 'recommendation' | 'ambiguous';
export type PromptTier = 'base' | 'full';

export interface ParsedMessage {
  /** User's free text with UI-generated prefixes stripped */
  cleanText: string;
  /** Structured metadata extracted from bracket prefixes */
  prefixes: {
    /** ISO date string from [date: YYYY-MM-DD] prefix, if present */
    date?: string;
    /** Meal type from [breakfast] / [lunch] / [dinner] / [snack] prefix, if present */
    mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  };
}

export interface IntentClassification {
  intent: MessageIntent;
  /** Matched signal words that drove the classification — included in telemetry */
  signals: string[];
}

// ─── Normalisation ─────────────────────────────────────────────────────────

function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '');
}

// ─── Prefix parser (T002) ───────────────────────────────────────────────────

const MEAL_TYPE_VALUES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

/**
 * Strips UI-generated bracket prefixes from a raw chat message before intent
 * classification so they don't influence the signal matching.
 *
 * Recognised prefixes:
 *   [date: YYYY-MM-DD]  →  prefixes.date
 *   [breakfast|lunch|dinner|snack]  →  prefixes.mealType
 */
export function parseMessagePrefixes(raw: string): ParsedMessage {
  const prefixes: ParsedMessage['prefixes'] = {};
  let cleanText = raw;

  // [date: YYYY-MM-DD]
  const dateMatch = /\[date:\s*(\d{4}-\d{2}-\d{2})\]/i.exec(cleanText);
  if (dateMatch) {
    prefixes.date = dateMatch[1];
    cleanText = cleanText.replace(dateMatch[0], '').trim();
  }

  // [breakfast|lunch|dinner|snack]
  const mealMatch = /\[(breakfast|lunch|dinner|snack)\]/i.exec(cleanText);
  if (mealMatch) {
    const candidate = mealMatch[1].toLowerCase();
    if ((MEAL_TYPE_VALUES as readonly string[]).includes(candidate)) {
      prefixes.mealType = candidate as ParsedMessage['prefixes']['mealType'];
    }
    cleanText = cleanText.replace(mealMatch[0], '').trim();
  }

  // [shared with: ...] — strip sharing metadata injected by the UI
  cleanText = cleanText.replace(/\[shared with:[^\]]*\]/gi, '').trim();

  return { cleanText: cleanText.trim(), prefixes };
}

// ─── Signal sets ────────────────────────────────────────────────────────────
// Exported for extensibility — a future trained classifier can import and
// extend these lists without changing the classifyIntent() interface.

/** Past-tense eating/drinking verbs that strongly indicate a logging action */
export const LOGGING_SIGNALS: readonly string[] = [
  // Spanish
  'tuve', 'comí', 'comi', 'comimos', 'cenamos', 'desayuné', 'desayune',
  'almorcé', 'almorce', 'tomé', 'tome', 'bebí', 'bebi', 'me comí', 'me comi',
  'acabé', 'acabe', 'terminé', 'termine', 'desayunamos', 'almorzamos',
  'merendé', 'merende',
  // English
  'had', 'ate', 'drank', 'just had', 'just ate', 'just drank',
  'for breakfast', 'for lunch', 'for dinner', 'as a snack', 'i ate', 'i had',
];

/** Keywords that request recommendations, suggestions, or meal planning */
export const RECOMMENDATION_SIGNALS: readonly string[] = [
  // Spanish
  'qué debería', 'que deberia', 'recomienda', 'recomiéndame', 'recomiendame',
  'sugiere', 'sugiéreme', 'sugiereme', 'planifica', 'qué como', 'que como',
  'qué puedo comer', 'que puedo comer', 'propón', 'propon', 'dame ideas',
  'qué hay', 'que hay', 'tengo ganas de', 'qué me recomiendas', 'que me recomiendas',
  'plan de comidas', 'planear', 'planifica mi semana', 'qué debería comer',
  // English
  'what should i eat', 'suggest', 'recommend', 'plan my', 'what can i have',
  'give me ideas', 'what do i eat', 'plan meals', 'meal plan',
  'what to eat', 'what should i have', 'what do you suggest',
];

/** Keywords that indicate a management action (view history, edit, delete) */
export const MANAGEMENT_SIGNALS: readonly string[] = [
  // Spanish
  'borra', 'elimina', 'edita', 'corrige', 'muéstrame', 'muestrame',
  'qué comí', 'que comi', 'qué tuve', 'que tuve', 'modifica', 'muestra',
  'bórralo', 'borralo', 'elimínalo', 'eliminalo', 'qué registré', 'que registre',
  // English
  'delete', 'remove', 'edit', 'fix', 'show me', 'what did i eat',
  'update', 'change', 'correct', 'modify', 'my history', 'show my',
];

// ─── Classifier (T004 stub → filled by T005, T010, T011, T012) ─────────────

/**
 * Classifies the intent of a clean (prefix-stripped) user message.
 *
 * Classification rules:
 *  - logging:        ≥1 logging signal, 0 recommendation signals
 *  - recommendation: ≥1 recommendation signal, 0 logging signals
 *  - management:     ≥1 management signal, 0 logging or recommendation signals
 *  - ambiguous:      mixed signals (logging + recommendation), or no signals at all
 */
export function classifyIntent(cleanText: string): IntentClassification {
  const norm = normalise(cleanText);

  const matched = {
    logging:        [] as string[],
    recommendation: [] as string[],
    management:     [] as string[],
  };

  for (const signal of LOGGING_SIGNALS) {
    if (norm.includes(normalise(signal))) matched.logging.push(signal);
  }
  for (const signal of RECOMMENDATION_SIGNALS) {
    if (norm.includes(normalise(signal))) matched.recommendation.push(signal);
  }
  for (const signal of MANAGEMENT_SIGNALS) {
    if (norm.includes(normalise(signal))) matched.management.push(signal);
  }

  const hasLogging        = matched.logging.length > 0;
  const hasRecommendation = matched.recommendation.length > 0;
  const hasManagement     = matched.management.length > 0;
  const allSignals        = [...matched.logging, ...matched.recommendation, ...matched.management];

  // Mixed intent or no signals → ask for clarification (ambiguous)
  if ((hasLogging && hasRecommendation) ||
      (!hasLogging && !hasRecommendation && !hasManagement)) {
    return { intent: 'ambiguous', signals: allSignals };
  }

  if (hasLogging && !hasRecommendation) {
    return { intent: 'logging', signals: matched.logging };
  }

  if (hasRecommendation && !hasLogging) {
    return { intent: 'recommendation', signals: matched.recommendation };
  }

  if (hasManagement) {
    return { intent: 'management', signals: matched.management };
  }

  return { intent: 'ambiguous', signals: allSignals };
}

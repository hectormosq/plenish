import { CONFIDENCE_HIGH, CONFIDENCE_LOW } from './config';
import type { ConfidenceLevel } from './schemas';
import type { PipelineNode, ResolvedDish } from './types';

// ---------------------------------------------------------------------------
// gate — turns confidence into an action (spec §Confidence Levels & Thresholds).
// Code only, no model call.
// ---------------------------------------------------------------------------

const RANK: Record<ConfidenceLevel, number> = { low: 0, medium: 1, high: 2 };

/** Level of one dish: history and user-listed ingredients are always high. */
export function dishLevel(source: ResolvedDish['source'], score: number | null): ConfidenceLevel {
  if (source === 'history' || source === 'user') return 'high';
  const s = score ?? 0;
  if (s >= CONFIDENCE_HIGH) return 'high';
  if (s < CONFIDENCE_LOW) return 'low';
  return 'medium';
}

/** A meal is as confident as its least confident dish. */
export function mealLevel(levels: ConfidenceLevel[]): ConfidenceLevel {
  if (levels.length === 0) return 'low';
  return levels.reduce((lowest, l) => (RANK[l] < RANK[lowest] ? l : lowest));
}

export type GateAction = 'save' | 'confirm' | 'ask';

export interface GateOutput {
  meal_level: ConfidenceLevel;
  action: GateAction;
  /** Dish to ask about when the action is 'ask'. */
  askAbout?: string;
}

export function decide(dishes: Pick<ResolvedDish, 'confidence_level' | 'parsed'>[]): GateOutput {
  const meal_level = mealLevel(dishes.map((d) => d.confidence_level));
  if (meal_level === 'high') return { meal_level, action: 'save' };
  if (meal_level === 'medium') return { meal_level, action: 'confirm' };
  const unsure = dishes.find((d) => d.confidence_level === 'low');
  return { meal_level, action: 'ask', askAbout: unsure?.parsed.dish_name };
}

export const gateNode: PipelineNode<{ dishes: ResolvedDish[] }, GateOutput> = {
  name: 'gate',
  async run({ dishes }) {
    const started = Date.now();
    const output = decide(dishes);
    return {
      output,
      usage: [{ name: 'gate', input_tokens: 0, output_tokens: 0, latency_ms: Date.now() - started, summary: { ...output } }],
    };
  },
};

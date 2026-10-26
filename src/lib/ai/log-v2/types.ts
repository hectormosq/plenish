import type { LanguageModel } from 'ai';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RunStep } from '@/lib/ai/runs';
import type { MealTypeValue } from '@/lib/ai/log-context';
import type { MealNutrition } from '@/lib/ai/nutrition-schemas';
import type { Lang } from '@/lib/i18n';
import type { ConfidenceLevel, DraftIngredient } from './schemas';

// ---------------------------------------------------------------------------
// Shared types of the v2 pipeline nodes (contracts/pipeline-nodes.md).
// Each node is replaceable as long as it keeps its input and output types.
// ---------------------------------------------------------------------------

export interface NodeContext {
  model: LanguageModel;
  supabase: SupabaseClient;
  /** From supabase.auth.getUser() — never from the model or the client. */
  userId: string;
  tzOffsetMinutes: number;
  now: Date;
}

/** Usage of one node, stored in ai_pipeline_runs.steps. */
export type StepUsage = RunStep;

export interface PipelineNode<In, Out> {
  name: string;
  run(input: In, ctx: NodeContext): Promise<{ output: Out; usage: StepUsage[] }>;
}

export interface ParsedDish {
  dish_name: string;
  dish_key: string;
  stated_quantities: { name: string; grams: number }[];
  listed_ingredients: string[];
}

export interface ParsedMeal {
  language: Lang;
  meal_type: MealTypeValue;
  /** ISO timestamp */
  eaten_at: string;
  /** Eaten together with the household (shared with every active co-member). */
  is_shared: boolean;
  dishes: ParsedDish[];
}

export interface HistoryMatch {
  meal_id: string;
  eaten_at: string;
  ingredients: DraftIngredient[];
  /** The earlier meal's nutrition summary, reusable when both meals are this single dish. */
  nutrition: MealNutrition | null;
  /** True when the earlier meal contained only this dish. */
  single_dish: boolean;
}

/** A dish after ingredients and portions are resolved. */
export interface ResolvedDish {
  parsed: ParsedDish;
  source: 'history' | 'model' | 'user';
  confidence_score: number | null;
  confidence_level: ConfidenceLevel;
  history: HistoryMatch | null;
  ingredients: DraftIngredient[];
}

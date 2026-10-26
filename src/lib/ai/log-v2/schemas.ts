import { z } from 'zod';
import type { UIMessage } from 'ai';
import { NutritionSchema } from '@/lib/ai/nutrition-schemas';
import { MealTypeEnum } from '@/lib/ai/log-context';
import { MAX_DISHES, MAX_INGREDIENTS_PER_DISH } from './config';

// ---------------------------------------------------------------------------
// MealDraft — the meal table shown in the chat (contracts/meal-draft.md).
// It travels to the browser and back, so the server validates it on every use
// and recomputes every derived field.
// ---------------------------------------------------------------------------

export const QuantitySourceEnum = z.enum(['stated', 'estimated', 'history', 'user']);
export const ConfidenceLevelEnum = z.enum(['high', 'medium', 'low']);
export const DishSourceEnum = z.enum(['history', 'model', 'user']);

export const DraftIngredientSchema = z.object({
  name:            z.string().trim().min(1).max(120),
  quantity_g:      z.number().positive().max(5000),
  quantity_source: QuantitySourceEnum,
});

export const DraftDishSchema = z.object({
  dish_name:        z.string().trim().min(1).max(120),
  dish_key:         z.string(),
  source:           DishSourceEnum,
  confidence_score: z.number().min(0).max(1).nullable(),
  confidence_level: ConfidenceLevelEnum,
  /** Earlier meal the ingredients were copied from, when source is 'history'. */
  history_eaten_at: z.string().nullable().default(null),
  ingredients:      z.array(DraftIngredientSchema).min(1).max(MAX_INGREDIENTS_PER_DISH),
});

export const MealDraftSchema = z.object({
  version:         z.literal(1),
  run_id:          z.uuid(),
  meal_id:         z.uuid().nullable(),
  status:          z.enum(['pending', 'saved']),
  changes_pending: z.boolean().default(false),
  language:        z.enum(['es', 'en']),
  log_text:        z.string().min(1).max(500),
  meal_type:       MealTypeEnum,
  eaten_at:        z.iso.datetime(),
  is_shared:       z.boolean().default(false),
  /** Co-eaters picked in the input; null = every active household member. */
  co_eater_ids:    z.array(z.uuid()).max(20).nullable().default(null),
  dishes:          z.array(DraftDishSchema).min(1).max(MAX_DISHES),
  meal_level:      ConfidenceLevelEnum,
  nutrition:       NutritionSchema,
});

export type QuantitySource = z.infer<typeof QuantitySourceEnum>;
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelEnum>;
export type DraftIngredient = z.infer<typeof DraftIngredientSchema>;
export type DraftDish = z.infer<typeof DraftDishSchema>;
export type MealDraft = z.infer<typeof MealDraftSchema>;

/** Chat messages as Plenish streams them: text, tool parts and the meal-draft data part. */
export type PlenishUIMessage = UIMessage<never, { 'meal-draft': MealDraft }>;

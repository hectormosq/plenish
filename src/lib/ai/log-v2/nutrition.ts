import { z } from 'zod';
import { ServingCategoryEnum } from '@/lib/ai/nutrition-schemas';
import type { MealNutrition, ServingCategory } from '@/lib/ai/nutrition-schemas';
import { callStructured } from './llm';
import type { DraftDish } from './schemas';
import type { NodeContext, PipelineNode } from './types';

// ---------------------------------------------------------------------------
// nutrition — the meal-level summary existing features read (food groups,
// protein type, servings, occasional food). One model call per meal.
// No kcal or macros (research R12; issue #71 will compute them from grams).
// ---------------------------------------------------------------------------

// Model-facing schema: every field required (strict JSON schema), servings as a
// full map of integers; zeros are stripped in code to match NutritionSchema.
const NutritionCallSchema = z.object({
  food_groups: z.array(z.enum(['vitaminas', 'proteinas', 'hidratos']))
    .describe('Which of the three food groups the meal covers.'),
  protein_type: z.enum(['white_meat', 'red_meat', 'fish_blue', 'fish_white', 'eggs', 'legumes']).nullable()
    .describe('Primary protein type, or null if the meal has no relevant protein.'),
  servings: z.object(
    Object.fromEntries(ServingCategoryEnum.options.map((c) => [c, z.number().int()])) as Record<ServingCategory, z.ZodNumber>,
  ).describe('Whole serving counts per category for the given grams; 0 when absent.'),
  has_occasional_food: z.boolean()
    .describe('True if the meal contains occasional foods (sweets, pastries, cold cuts, sausages, sugary drinks).'),
});

const SYSTEM = `You classify a meal for a serving-based nutrition plan (Spanish dietary guidelines).
Reference servings: grains 60–80 g raw (pasta, rice) or 40–60 g bread; vegetables 150–200 g; fruit 120–200 g; dairy 200–250 ml milk, 125 g yogurt or 40–60 g cheese; meat 100–125 g; fish 125–150 g; eggs 1–2 units (60 g each); legumes 60–80 g raw; nuts 20–30 g.
Count whole servings from the grams given (round to the nearest whole number; a clearly present ingredient below half a serving counts as 0).`;

export const nutritionNode: PipelineNode<{ dishes: Pick<DraftDish, 'dish_name' | 'ingredients'>[] }, { meal: MealNutrition }> = {
  name: 'nutrition',
  async run({ dishes }, ctx: NodeContext) {
    const description = dishes
      .map((d) => `${d.dish_name}: ${d.ingredients.map((i) => `${i.name} ${i.quantity_g} g`).join(', ')}`)
      .join('\n');

    const { output, usage } = await callStructured(ctx, 'nutrition', {
      system: SYSTEM,
      prompt: `Meal:\n${description}`,
      schema: NutritionCallSchema,
    });

    const servings = Object.fromEntries(
      Object.entries(output.servings).filter(([, v]) => Number.isFinite(v) && v > 0).map(([k, v]) => [k, Math.round(v)]),
    ) as MealNutrition['servings'];

    const meal: MealNutrition = {
      food_groups: [...new Set(output.food_groups)],
      protein_type: output.protein_type,
      servings,
      has_occasional_food: output.has_occasional_food,
      portion_confidence: 'estimated',
    };
    return { output: { meal }, usage: [{ ...usage, summary: { servings } }] };
  },
};

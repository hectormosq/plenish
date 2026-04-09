import { z } from 'zod';

export const ServingCategoryEnum = z.enum([
  'dairy', 'grains', 'fruit', 'vegetables', 'fish', 'meat', 'eggs', 'nuts', 'legumes',
]);

// Sparse servings — only non-zero categories stored.
export const ServingsSchema = z.record(ServingCategoryEnum, z.number().int().min(1))
  .describe('Sparse map — include only categories with count >= 1. Omit zeroes.');

export const NutritionSchema = z.object({
  food_groups: z.array(z.enum(['vitaminas', 'proteinas', 'hidratos']))
    .describe('Which of the three food groups this meal covers.'),
  protein_type: z.enum(['white_meat', 'red_meat', 'fish_blue', 'fish_white', 'eggs', 'legumes'])
    .nullable()
    .describe('Primary protein type, or null if no protein.'),
  servings: ServingsSchema,
  has_occasional_food: z.boolean()
    .describe('True if the meal contains occasional foods (sweets, cold cuts, sausages, etc.).'),
  portion_confidence: z.enum(['from_recipe', 'stated', 'estimated'])
    .describe('"stated" = user gave quantities; "estimated" = inferred from serving_sizes defaults; "from_recipe" = derived from linked recipe ingredients.'),
});

export type ServingCategory  = z.infer<typeof ServingCategoryEnum>;
export type MealNutrition    = z.infer<typeof NutritionSchema>;

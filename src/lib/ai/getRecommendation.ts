import { generateText, Output } from "ai";
import { z } from "zod";
import { getAIModel } from "@/lib/ai/provider";
import type { MealLog } from "@/actions/meals";

export const RecommendationSchema = z.object({
  name: z
    .string()
    .describe(
      "Name of the recommended dish, in Spanish if culturally appropriate",
    ),
  description: z.string().describe("1-2 sentence description of the dish"),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  prepTimeMinutes: z.number().int().positive(),
  estimatedCalories: z.number().int().positive(),
  reason: z
    .string()
    .describe("Why this meal is being recommended based on the user history"),
  ingredients: z.array(z.string()).max(8).describe("Main ingredients list"),
});

export type Recommendation = z.infer<typeof RecommendationSchema>;

function buildRecentSummary(recentMeals: MealLog[]): string {
  if (recentMeals.length === 0) return "No recent meal history.";
  return recentMeals.map((m) => `- ${m.meal_type}: ${m.log_text}`).join("\n");
}

export async function generateSinglePlan(
  mealType: string,
  date: string,
  recentMeals: MealLog[],
  rejectedSummary: string,
  systemPrompt: string,
): Promise<Recommendation> {
  const model = getAIModel();
  const rejectedPart = rejectedSummary ? `\n\n${rejectedSummary}` : "";

  const finalPrompt = {
    model,
    output: Output.object({ schema: RecommendationSchema }),
    system: systemPrompt,
    prompt: `Plan a ${mealType} for ${date}.

    Recent meal history:
    ${buildRecentSummary(recentMeals)}${rejectedPart}`
  };
  
  console.log(finalPrompt);

  const result = await generateText(finalPrompt);

  return result.output;
}

const WeekPlanSchema = z.object({
  meals: z.array(RecommendationSchema),
});

export async function generateWeekPlan(
  slots: { mealType: string; date: string }[],
  recentMeals: MealLog[],
  rejectedSummary: string,
  systemPrompt: string,
): Promise<Recommendation[]> {
  const model = getAIModel();
  const rejectedPart = rejectedSummary ? `\n\n${rejectedSummary}` : "";
  const slotsList = slots.map((s) => `- ${s.mealType} on ${s.date}`).join("\n");

  const result = await generateText({
    model,
    output: Output.object({ schema: WeekPlanSchema }),
    system: systemPrompt,
    prompt: `Plan the following ${slots.length} meals:
${slotsList}

Recent meal history:
${buildRecentSummary(recentMeals)}${rejectedPart}

Suggest a different meal for each slot. Return exactly ${slots.length} meals in the meals array, one per slot in the same order listed.`,
  });

  return result.output.meals;
}

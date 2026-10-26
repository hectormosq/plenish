import { z } from 'zod';
import type { MealTypeValue } from '@/lib/ai/log-context';
import { MAX_DISHES } from './config';
import { normalizeDishKey } from './dish-key';
import { callStructured, localNow } from './llm';
import type { NodeContext, ParsedDish, ParsedMeal, PipelineNode } from './types';

// ---------------------------------------------------------------------------
// parse — splits the message into dishes and reads meal type, time, language,
// stated quantities and ingredients the user listed. One model call.
// ---------------------------------------------------------------------------

const ParseSchema = z.object({
  language: z.enum(['es', 'en']).describe('Language the user wrote in.'),
  meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).nullable()
    .describe('Meal type if the user says it or it is clear from the words; otherwise null.'),
  eaten_at: z.string().nullable()
    .describe('ISO 8601 local date-time only when the user names another day or time; otherwise null.'),
  is_shared: z.boolean()
    .describe('True when several household members ate it together: first-person plural cues such as "comimos", "cenamos", "we had", "todos".'),
  dishes: z.array(z.object({
    dish_name: z.string().describe('Canonical dish name without quantities or articles, e.g. "arepa catira", "café con leche".'),
    stated_quantities: z.array(z.object({
      name: z.string().describe('Food the quantity refers to.'),
      grams: z.number().describe('Quantity in grams; convert units the user gave (1 vaso de leche ≈ 250 g).'),
    })).describe('Only quantities the user wrote. Empty when none.'),
    listed_ingredients: z.array(z.string())
      .describe('Ingredients the user explicitly listed for this dish, e.g. "lleva harina, queso y jamón". Empty when none.'),
  })).describe('One entry per dish or drink eaten. Sides that are separate dishes are separate entries.'),
});

const SYSTEM = `You read a message in which a user reports what they ate or drank, and extract structured data. Do not invent foods the user did not mention.
Dishes: each food belongs to exactly one dish. A food that is part of a dish's name is not a separate dish ("pisto con huevo" is one dish; "arroz con pollo" is one dish). Split only separate plates, sides or drinks ("entrecot con ensalada" → entrecot, ensalada; "café y tostada" → café, tostada).
Quantities: only amounts or counts the user wrote ("dos huevos" ≈ 100 g, "300 g de entrecot"), on the dish they belong to. Never add a quantity for a food the user did not quantify.
Language: "es" unless the message is written in English. A message that is only a dish name ("bandeja paisa", "tacos al pastor") is "es".
If the previous assistant message asked what a dish contains, the user's reply lists its ingredients: keep that dish and put them in listed_ingredients.`;

/** Default meal type from the user's local hour (Spanish meal times). */
export function mealTypeForHour(hour: number): MealTypeValue {
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  if (hour < 20) return 'snack';
  return 'dinner';
}

export const parseNode: PipelineNode<{ text: string; previousAssistantText?: string }, ParsedMeal> = {
  name: 'parse',
  async run({ text, previousAssistantText }, ctx: NodeContext) {
    const now = localNow(ctx);
    const previous = previousAssistantText?.trim()
      ? `Previous assistant message: ${previousAssistantText.trim().slice(0, 500)}\n`
      : '';

    const { output, usage } = await callStructured(ctx, 'parse', {
      system: SYSTEM,
      prompt: `User's local time now: ${now.label}\n${previous}User message: ${text}`,
      schema: ParseSchema,
    });

    const dishes: ParsedDish[] = output.dishes
      .map((d) => ({
        dish_name: d.dish_name.trim().slice(0, 120),
        dish_key: normalizeDishKey(d.dish_name),
        stated_quantities: d.stated_quantities.filter((q) => q.name.trim() && Number.isFinite(q.grams) && q.grams > 0),
        listed_ingredients: d.listed_ingredients.map((i) => i.trim()).filter(Boolean),
      }))
      .filter((d) => d.dish_name && d.dish_key)
      .slice(0, MAX_DISHES);

    // A dish named inside another dish's name is part of it ("huevo" in "pisto con huevo").
    const contains = (outer: string, inner: string) => outer !== inner && ` ${outer} `.includes(` ${inner} `);
    for (const part of dishes.filter((d) => dishes.some((o) => contains(o.dish_key, d.dish_key)))) {
      const whole = dishes.find((o) => contains(o.dish_key, part.dish_key))!;
      whole.stated_quantities.push(...part.stated_quantities);
      dishes.splice(dishes.indexOf(part), 1);
    }

    // A quantity that names another dish belongs to that dish, not this one.
    for (const dish of dishes) {
      const others = dishes.filter((d) => d !== dish).map((d) => d.dish_key);
      dish.stated_quantities = dish.stated_quantities.filter((q) => !others.includes(normalizeDishKey(q.name)));
    }

    // The model gives a local time; convert it to UTC with the browser offset.
    let eaten_at = now.iso;
    if (output.eaten_at && !Number.isNaN(Date.parse(output.eaten_at))) {
      const raw = /^\d{4}-\d{2}-\d{2}$/.test(output.eaten_at) ? `${output.eaten_at}T12:00:00` : output.eaten_at;
      const localMs = Date.parse(raw.replace(/(Z|[+-]\d{2}:?\d{2})$/, '') + 'Z');
      const utc = new Date(localMs + ctx.tzOffsetMinutes * 60_000);
      if (utc.getTime() <= ctx.now.getTime() + 60_000) eaten_at = utc.toISOString();
    }

    return {
      output: {
        language: output.language,
        meal_type: output.meal_type ?? mealTypeForHour(now.hour),
        eaten_at,
        is_shared: output.is_shared,
        dishes,
      },
      usage: [{ ...usage, summary: { dishes: dishes.length } }],
    };
  },
};

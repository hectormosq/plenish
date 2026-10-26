import { z } from 'zod';
import type { Lang } from '@/lib/i18n';
import { MAX_INGREDIENTS_PER_DISH } from './config';
import { normalizeDishKey } from './dish-key';
import { callStructured } from './llm';
import type { NodeContext, ParsedDish, PipelineNode } from './types';

// ---------------------------------------------------------------------------
// ingredients — what a dish is made of, with standard portions and a
// confidence score. One model call per dish (run in parallel by the pipeline).
// Future: web search for low scores (#68), dish catalog before this node (#69).
// ---------------------------------------------------------------------------

const IngredientsSchema = z.object({
  confidence: z.number().describe('0 to 1, following the scoring rubric.'),
  ingredients: z.array(z.object({
    name: z.string().describe('Ingredient name in the requested language.'),
    quantity_g: z.number().describe('Standard single-serving amount in grams.'),
  })),
});

const SYSTEM = `You know the cuisines of Spain and Latin America well. Given a dish a user ate, list its main ingredients with a standard single-serving amount in grams for each (e.g. entrecot 250 g, arroz cocido 150 g, aceite de oliva 10 g).
List only the ingredients that carry the dish's nutrition: dough or base, proteins, cheese, legumes, vegetables that are a real part of the dish, sauces, cooking fat. Do not add side dishes the user did not mention.
Leave out what is only there for flavor in small amounts: water, salt, pepper, spices, herbs, garlic, stock cubes, and onion, peppers or tomato used only to season a stew or sofrito ("pollo mechado" → pollo, not cebolla or pimentón). Keep them when they are a main part of the dish (cebolla in ceviche, pimiento in gazpacho or pisto).
Amounts are what one person eats in one serving, never a whole recipe or batch. A basic or ready-made food ("pan", "yogur", "queso", "café") is a single ingredient, itself at one serving ("pan" → pan 60 g); never list how it is made.

Score how sure you are that this is what the dish contains:
- 0.90–1.00: well-known dish with a standard recipe and the description matches it ("tortilla de patatas", "entrecot"), or a single basic food ("huevo", "manzana", "pan").
- 0.70–0.89: known dish with common regional or household variations ("arepa catira", "paella").
- 0.50–0.69: generic description; you can propose a typical version but the user may have had something else ("ensalada", "un bocadillo", "pasta").
- 0.00–0.49: you do not recognise the dish and cannot propose a plausible version.
If the main word of the dish is not a food or dish you know, score below 0.50 even if you can list something; never guess from vague words around it ("de la abuela", "casero", "especial").`;

// Flavor-only ingredients dropped even when the model lists them. Matched on the
// first word only, so "sal marina" goes but "salsa de ajo" or "pan de ajo" stay.
const FLAVOR_ONLY = new Set([
  'agua', 'sal', 'pimienta', 'especias', 'ajo', 'comino', 'oregano', 'perejil', 'cilantro', 'laurel', 'caldo', 'cubito', 'avecrem',
  'water', 'salt', 'spices', 'garlic', 'cumin', 'parsley', 'coriander', 'broth', 'stock',
]);

const isFlavorOnly = (name: string) => FLAVOR_ONLY.has(normalizeDishKey(name).split(' ')[0]);

export interface IngredientsOutput {
  confidence: number;
  /** True when the user listed the ingredients themselves. */
  fromUser: boolean;
  ingredients: { name: string; quantity_g: number }[];
}

export const ingredientsNode: PipelineNode<{ dish: ParsedDish; language: Lang }, IngredientsOutput> = {
  name: 'ingredients',
  async run({ dish, language }, ctx: NodeContext) {
    const fromUser = dish.listed_ingredients.length > 0;
    const languageName = language === 'en' ? 'English' : 'Spanish';
    const listed = fromUser
      ? `\nThe user listed the ingredients: ${dish.listed_ingredients.join(', ')}. Use exactly these ingredients (do not add others) and only assign grams.`
      : '';

    const { output, usage } = await callStructured(ctx, 'ingredients', {
      system: SYSTEM,
      prompt: `Dish: ${dish.dish_name}${listed}\nWrite ingredient names in ${languageName}.`,
      schema: IngredientsSchema,
    });

    const ingredients = output.ingredients
      .map((i) => ({ name: i.name.trim().slice(0, 120), quantity_g: i.quantity_g }))
      .filter((i) => i.name && (fromUser || !isFlavorOnly(i.name)))
      .slice(0, MAX_INGREDIENTS_PER_DISH);
    const confidence = fromUser ? 1 : Math.min(1, Math.max(0, Number.isFinite(output.confidence) ? output.confidence : 0));

    return {
      output: { confidence, fromUser, ingredients },
      usage: [{ ...usage, summary: { dish: dish.dish_name, confidence, ingredients: ingredients.length } }],
    };
  },
};

import { tool } from 'ai';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// createMealTools(tzOffsetMinutes)
// Factory that returns all meal tools closed over the user's UTC offset.
// tzOffsetMinutes: value of new Date().getTimezoneOffset() from the browser
//   (positive = behind UTC, e.g. UTC-5 → 300; negative = ahead, UTC+2 → -120)
// ---------------------------------------------------------------------------
export function createMealTools(tzOffsetMinutes: number) {
  const tz = Number.isFinite(tzOffsetMinutes) ? tzOffsetMinutes : 0;

  // ---------------------------------------------------------------------------
  // getMealsTool
  // Fetches the authenticated user's meal history for a given time period.
  // Date windows are computed in the user's local timezone using tz offset.
  // ---------------------------------------------------------------------------
  const getMealsTool = tool({
    description:
      "Fetch the authenticated user's meal history for a given time period. " +
      'Call this tool before making any food recommendation — use the returned meal history ' +
      'to understand what the user has already eaten and ensure suggestions complement their ' +
      'day nutritionally according to the three food groups (vitamins, proteins, carbohydrates). ' +
      'Also call this to answer questions about what the user has eaten (today, yesterday, this week). ' +
      'Never describe meals the user did not log.',
    inputSchema: z.object({
      period: z
        .enum(['today', 'yesterday', 'week'])
        .optional()
        .default('today')
        .describe('Time window to query. Defaults to today.'),
    }),
    execute: async ({ period }) => {
      const supabase = await createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return { meals: [], count: 0, error: 'Unauthorized' };
      }

      const now = new Date();
      let rangeStart: string;
      let rangeEnd: string;

      // Compute local-timezone-aware day boundaries.
      // getTimezoneOffset() returns UTC - local in minutes, so:
      //   localMidnightUTC = utcMidnight - tz * 60_000
      const offsetMs = tz * 60_000;

      if (period === 'today') {
        const localNowMs = now.getTime() - offsetMs;
        const localDate = new Date(localNowMs);
        const localDayStartMs =
          Date.UTC(
            localDate.getUTCFullYear(),
            localDate.getUTCMonth(),
            localDate.getUTCDate(),
            0, 0, 0, 0
          ) + offsetMs;
        rangeStart = new Date(localDayStartMs).toISOString();
        rangeEnd = now.toISOString();
      } else if (period === 'yesterday') {
        const localNowMs = now.getTime() - offsetMs;
        const localDate = new Date(localNowMs);
        const localYesterdayStartMs =
          Date.UTC(
            localDate.getUTCFullYear(),
            localDate.getUTCMonth(),
            localDate.getUTCDate() - 1,
            0, 0, 0, 0
          ) + offsetMs;
        const localTodayStartMs =
          Date.UTC(
            localDate.getUTCFullYear(),
            localDate.getUTCMonth(),
            localDate.getUTCDate(),
            0, 0, 0, 0
          ) + offsetMs;
        const localYesterdayEndMs = localTodayStartMs - 1;
        rangeStart = new Date(localYesterdayStartMs).toISOString();
        rangeEnd = new Date(localYesterdayEndMs).toISOString();
      } else {
        // week — last 7 local days
        const localNowMs = now.getTime() - offsetMs;
        const localDate = new Date(localNowMs);
        const localWeekStartMs =
          Date.UTC(
            localDate.getUTCFullYear(),
            localDate.getUTCMonth(),
            localDate.getUTCDate() - 7,
            0, 0, 0, 0
          ) + offsetMs;
        rangeStart = new Date(localWeekStartMs).toISOString();
        rangeEnd = now.toISOString();
      }

      const { data, error } = await supabase
        .from('meal_logs')
        .select('id, log_text, meal_type, eaten_at')
        .eq('user_id', user.id)
        .gte('eaten_at', rangeStart)
        .lte('eaten_at', rangeEnd)
        .order('eaten_at', { ascending: false });

      if (error) {
        return { meals: [], count: 0, error: error.message };
      }

      return { meals: data ?? [], count: (data ?? []).length };
    },
  });

  // ---------------------------------------------------------------------------
  // logMealTool
  // Records a meal the user described in natural language to their meal history.
  // ---------------------------------------------------------------------------
  const logMealTool = tool({
    description:
      'Record a meal the user just described to their meal history. ' +
      'Infer the meal_type (breakfast, lunch, dinner, snack) from the conversation context or time of day. ' +
      'Always confirm what you understood before calling this tool, then save it.',
    inputSchema: z.object({
      log_text: z
        .string()
        .min(1)
        .max(500)
        .describe('Free-text description of the meal as described by the user.'),
      meal_type: z
        .enum(['breakfast', 'lunch', 'dinner', 'snack'])
        .describe('Type of meal inferred from context.'),
      eaten_at: z
        .string()
        .optional()
        .describe('ISO 8601 timestamp of when the meal was eaten. Defaults to now.'),
    }),
    execute: async ({ log_text, meal_type, eaten_at }) => {
      const supabase = await createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return { success: false, error: 'Unauthorized' };
      }

      const { data, error } = await supabase
        .from('meal_logs')
        .insert({
          user_id: user.id,
          log_text,
          meal_type,
          eaten_at: eaten_at ?? new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      revalidatePath('/dashboard');
      return { success: true, meal_id: data.id, log_text, meal_type };
    },
  });

  // ---------------------------------------------------------------------------
  // saveRecipeTool
  // Infers and persists a recipe from a meal description.
  // Only call when ≥2 ingredients can be reasonably inferred.
  // ---------------------------------------------------------------------------
  const saveRecipeTool = tool({
    description:
      'Infer and save a recipe from a meal the user described. ' +
      "Call this tool after log_meal when you can reasonably infer at least 2 ingredients " +
      "from the dish name or the user's description. " +
      "Save the user's version of the recipe — including any substitutions they mentioned " +
      '(e.g., yogurt instead of mayo). Do NOT call this tool for meals with fewer than 2 inferable ingredients ' +
      '(e.g., "a coffee"). Ingredient strings should include quantity and unit when mentioned ' +
      '(e.g., "60g harina de maíz cruda", "aguacate", "yogur natural").',
    inputSchema: z.object({
      name: z
        .string()
        .min(1)
        .max(200)
        .describe('Dish name as the user described it (e.g., "Reina Pepiada", "Avena con plátano").'),
      description: z
        .string()
        .describe("Short description of the dish reflecting the user's version."),
      ingredients: z
        .array(z.string())
        .min(2)
        .describe('List of ingredient strings. Include quantities/units when known.'),
      instructions: z
        .array(z.string())
        .default([])
        .describe('Preparation steps if inferable. Empty array is acceptable.'),
      language: z
        .enum(['es', 'en'])
        .default('es')
        .describe('Language of the recipe content. Match the language the user wrote in.'),
    }),
    execute: async ({ name, description, ingredients, instructions, language }) => {
      const supabase = await createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return { success: false, error: 'Unauthorized' };
      }

      const { data, error } = await supabase
        .from('recipes')
        .insert({
          user_id: user.id,
          name,
          description,
          ingredients,
          instructions,
          language,
        })
        .select('id')
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        recipe_id: data.id,
        name,
        ingredient_count: ingredients.length,
      };
    },
  });

  // ---------------------------------------------------------------------------
  // deleteMealTool
  // Deletes a specific meal log entry by ID after user confirmation.
  // IMPORTANT: always call getMealsTool first, present the entry to the user,
  // and only call this after explicit confirmation.
  // ---------------------------------------------------------------------------
  const deleteMealTool = tool({
    description:
      'Delete a specific meal log entry by ID. ' +
      'IMPORTANT: only call this tool AFTER you have shown the user the exact meal entry ' +
      'you intend to delete (log_text + time) and received their explicit confirmation. ' +
      'Never guess the meal_id — always retrieve it via get_meals first.',
    inputSchema: z.object({
      meal_id: z
        .string()
        .uuid()
        .describe('UUID of the meal_log entry to delete. Must be obtained from get_meals.'),
    }),
    execute: async ({ meal_id }) => {
      const supabase = await createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return { success: false, error: 'Unauthorized' };
      }

      const { error } = await supabase
        .from('meal_logs')
        .delete()
        .match({ id: meal_id, user_id: user.id });

      if (error) {
        return { success: false, error: error.message };
      }

      revalidatePath('/dashboard');
      return { success: true };
    },
  });

  // ---------------------------------------------------------------------------
  // updateMealTool
  // Updates log_text and/or meal_type of a specific meal log entry.
  // IMPORTANT: always call get_meals first, show the user the current entry and
  // proposed change, and only call this after explicit user confirmation.
  // ---------------------------------------------------------------------------
  const updateMealTool = tool({
    description:
      'Update a specific meal log entry by ID. ' +
      'IMPORTANT: only call this tool AFTER you have called get_meals to find the entry, ' +
      'shown the user the current values and the proposed change, and received their explicit confirmation. ' +
      'Never guess the meal_id — always retrieve it via get_meals first. ' +
      'At least one of log_text or meal_type must be provided.',
    inputSchema: z.object({
      meal_id: z
        .string()
        .uuid()
        .describe('UUID of the meal_log entry to update. Must be obtained from get_meals.'),
      log_text: z
        .string()
        .min(1)
        .max(500)
        .optional()
        .describe('New description for the meal. Omit to keep unchanged.'),
      meal_type: z
        .enum(['breakfast', 'lunch', 'dinner', 'snack'])
        .optional()
        .describe('New meal type. Omit to keep unchanged.'),
    }).refine(
      (data) => data.log_text !== undefined || data.meal_type !== undefined,
      { message: 'At least one of log_text or meal_type must be provided.' }
    ),
    execute: async ({ meal_id, log_text, meal_type }) => {
      const supabase = await createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return { success: false, error: 'Unauthorized' };
      }

      const updates: Record<string, string> = {};
      if (log_text !== undefined) updates.log_text = log_text;
      if (meal_type !== undefined) updates.meal_type = meal_type;

      const { error } = await supabase
        .from('meal_logs')
        .update(updates)
        .match({ id: meal_id, user_id: user.id });

      if (error) {
        return { success: false, error: error.message };
      }

      revalidatePath('/dashboard');
      return { success: true, meal_id, updated: updates };
    },
  });

  return { getMealsTool, logMealTool, saveRecipeTool, deleteMealTool, updateMealTool };
}

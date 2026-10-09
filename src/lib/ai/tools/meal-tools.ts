import { tool } from 'ai';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  ServingCategoryEnum,
  NutritionSchema,
} from '@/lib/ai/nutrition-schemas';
import type { MealNutrition } from '@/lib/ai/nutrition-schemas';
import { MealTypeEnum, resolveLogFields } from '@/lib/ai/log-context';
import type { LogContext, ResolvedLogFields } from '@/lib/ai/log-context';

export interface MealToSave extends ResolvedLogFields {
  nutrition: MealNutrition;
  inferred_ingredients?: string[];
}

export type SaveMealLog = (meal: MealToSave) => Promise<Record<string, unknown>>;

export interface MealToolsOptions {
  /** Values the logging form already knows; they override what the model infers. */
  logContext?: LogContext | null;
  /** Replaces the database write — used by the evals. */
  saveMealLog?: SaveMealLog;
}

// ---------------------------------------------------------------------------
// createMealTools(tzOffsetMinutes, options)
// Factory that returns all meal tools closed over the user's UTC offset.
// tzOffsetMinutes: value of new Date().getTimezoneOffset() from the browser
//   (positive = behind UTC, e.g. UTC-5 → 300; negative = ahead, UTC+2 → -120)
// ---------------------------------------------------------------------------
export function createMealTools(tzOffsetMinutes: number, options: MealToolsOptions = {}) {
  const tz = Number.isFinite(tzOffsetMinutes) ? tzOffsetMinutes : 0;
  const logContext = options.logContext ?? null;

  // ---------------------------------------------------------------------------
  // Shared timezone helper — returns { rangeStart, rangeEnd } ISO strings
  // ---------------------------------------------------------------------------
  function getDateRange(period: 'today' | 'yesterday' | 'week') {
    const now = new Date();
    const offsetMs = tz * 60_000;

    const localNowMs = now.getTime() - offsetMs;
    const localDate = new Date(localNowMs);

    const localDayStartMs = Date.UTC(
      localDate.getUTCFullYear(), localDate.getUTCMonth(), localDate.getUTCDate(),
      0, 0, 0, 0,
    ) + offsetMs;

    if (period === 'today') {
      return { rangeStart: new Date(localDayStartMs).toISOString(), rangeEnd: now.toISOString() };
    }

    if (period === 'yesterday') {
      const yesterdayStartMs = localDayStartMs - 86_400_000;
      const yesterdayEndMs   = localDayStartMs - 1;
      return {
        rangeStart: new Date(yesterdayStartMs).toISOString(),
        rangeEnd:   new Date(yesterdayEndMs).toISOString(),
      };
    }

    // week — last 7 local days
    const weekStartMs = Date.UTC(
      localDate.getUTCFullYear(), localDate.getUTCMonth(), localDate.getUTCDate() - 7,
      0, 0, 0, 0,
    ) + offsetMs;
    return { rangeStart: new Date(weekStartMs).toISOString(), rangeEnd: now.toISOString() };
  }

  // ---------------------------------------------------------------------------
  // getMealsTool
  // ---------------------------------------------------------------------------
  const getMealsTool = tool({
    description:
      "Fetch the authenticated user's meal history for a given time period. " +
      'Call this to answer questions about what the user has eaten (today, yesterday, this week). ' +
      'For recommendations or compliance checks, use get_daily_summary instead — it returns structured data without re-parsing text. ' +
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
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) return { meals: [], count: 0, error: 'Unauthorized' };

      const { rangeStart, rangeEnd } = getDateRange(period);

      const { data, error } = await supabase
        .from('meal_logs')
        .select('id, log_text, meal_type, eaten_at')
        .eq('user_id', user.id)
        .gte('eaten_at', rangeStart)
        .lte('eaten_at', rangeEnd)
        .order('eaten_at', { ascending: false });

      if (error) return { meals: [], count: 0, error: error.message };
      return { meals: data ?? [], count: (data ?? []).length };
    },
  });

  // ---------------------------------------------------------------------------
  // saveMealLog — the single write path for a logged meal.
  // Household and co-eaters are resolved here from the database, never taken
  // from the model, so a meal can only be shared with real co-members.
  // ---------------------------------------------------------------------------
  const saveMealLogToDb: SaveMealLog = async (meal) => {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { success: false, error: 'Unauthorized' };

    let householdId: string | null = null;
    let coEaters: string[] = [];
    if (meal.shared) {
      const { data: membership } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (membership) {
        householdId = membership.household_id as string;
        const { data: members } = await supabase
          .from('household_members')
          .select('user_id')
          .eq('household_id', householdId)
          .eq('status', 'active')
          .neq('user_id', user.id);

        const memberIds = (members ?? [])
          .map((m) => m.user_id as string | null)
          .filter((id): id is string => Boolean(id));
        const requested = meal.coEaterIds;
        coEaters = requested === 'all'
          ? memberIds
          : requested.filter((id) => memberIds.includes(id));
      }
    }
    // A meal can only be shared inside a household.
    const shared = meal.shared && householdId !== null;

    // Insert the meal log
    const { data, error } = await supabase
      .from('meal_logs')
      .insert({
        user_id: user.id,
        log_text: meal.log_text,
        meal_type: meal.meal_type,
        eaten_at: meal.eaten_at,
        nutrition: meal.nutrition,
        inferred_ingredients: meal.inferred_ingredients ?? null,
        is_shared: shared,
        household_id: shared ? householdId : null,
      })
      .select('id')
      .single();

    if (error) return { success: false, error: error.message };

    // Insert co-eater participant rows for shared meals
    const participants: string[] = [];
    if (shared && coEaters.length > 0) {
      const rows = coEaters.map((uid) => ({ meal_log_id: data.id, user_id: uid }));
      const { error: pError } = await supabase.from('meal_participants').insert(rows);
      if (!pError) participants.push(...coEaters);
    }

    // Search for an existing recipe by name similarity (ilike on most distinctive word)
    const words = meal.log_text.split(/\s+/);
    const keyword = words.find(w => w.length > 4) ?? words[0];
    const { data: match } = await supabase
      .from('recipes')
      .select('id, name, ingredients')
      .eq('user_id', user.id)
      .ilike('name', `%${keyword}%`)
      .limit(1)
      .maybeSingle();

    // Auto-clear any active plan for this slot
    const mealDate = meal.eaten_at.split('T')[0];
    await supabase
      .from('planned_meals')
      .update({ status: 'overridden', overridden_meal_id: data.id })
      .eq('user_id', user.id)
      .eq('meal_type', meal.meal_type)
      .eq('planned_date', mealDate)
      .eq('status', 'planned');

    revalidatePath('/dashboard');
    return {
      success: true,
      meal_id: data.id as string,
      meal_type: meal.meal_type,
      nutrition: meal.nutrition,
      is_shared: shared,
      participants,
      recipe_suggestion: match ?? null,
    };
  };

  const saveMealLog = options.saveMealLog ?? saveMealLogToDb;

  // Strip zero-value servings the model sometimes includes despite schema guidance
  const cleanNutrition = (nutrition: MealNutrition): MealNutrition => ({
    ...nutrition,
    servings: Object.fromEntries(
      Object.entries(nutrition.servings ?? {}).filter(([, v]) => (v as number) > 0),
    ),
  });

  const describedMealFields = {
    log_text: z.string().min(1).max(500)
      .describe('Free-text description of the meal as described by the user.'),
    nutrition: NutritionSchema,
    inferred_ingredients: z.array(z.string()).optional()
      .describe(
        'Ingredient strings inferred from the description. Include quantity and unit when stated ' +
        '(e.g. "1 arepa (60g harina de maíz)", "40g queso feta"). ' +
        'Populate even when a recipe_suggestion might exist — it is cleared automatically if the user links a recipe.',
      ),
  };

  // ---------------------------------------------------------------------------
  // formLogMealTool — used when the logging form supplied the meal type.
  // Meal type, date and sharing come from the form, so the model only describes
  // the food.
  // ---------------------------------------------------------------------------
  const formLogMealTool = tool({
    description:
      'Record the meal the user just described. ' +
      'The app has already set the meal type, date and sharing — provide only the description, ' +
      'the inferred nutrition and the inferred ingredients.',
    inputSchema: z.object(describedMealFields),
    execute: async ({ log_text, nutrition, inferred_ingredients }) =>
      saveMealLog({
        ...resolveLogFields({ log_text }, logContext, new Date().toISOString()),
        nutrition: cleanNutrition(nutrition),
        inferred_ingredients,
      }),
  });

  // ---------------------------------------------------------------------------
  // logMealTool — free-text chat logging; the model infers meal type and date.
  // Any value the form did provide (date, sharing) still wins.
  // ---------------------------------------------------------------------------
  const logMealTool = tool({
    description:
      'Record a meal the user just described to their meal history. ' +
      'Infer the meal_type (breakfast, lunch, dinner, snack) from conversation context or time of day. ' +
      'Always infer nutrition and inferred_ingredients from the description.',
    inputSchema: z.object({
      ...describedMealFields,
      meal_type: MealTypeEnum
        .describe('Type of meal inferred from context.'),
      eaten_at: z.string().optional()
        .describe('ISO 8601 timestamp of when the meal was eaten. Set only when the user names another day or time; omit for now.'),
      is_shared: z.boolean().optional().default(false)
        .describe(
          'True when multiple household members ate this meal together. ' +
          'Set when the user uses first-person plural cues: "comimos", "cenamos", "todos", "en casa juntos".',
        ),
    }),
    execute: async ({ log_text, meal_type, eaten_at, is_shared, nutrition, inferred_ingredients }) =>
      saveMealLog({
        ...resolveLogFields({ log_text, meal_type, eaten_at, is_shared }, logContext, new Date().toISOString()),
        nutrition: cleanNutrition(nutrition),
        inferred_ingredients,
      }),
  });

  // ---------------------------------------------------------------------------
  // saveRecipeTool
  // ---------------------------------------------------------------------------
  const saveRecipeTool = tool({
    description:
      'Infer and save a recipe from a meal the user described. ' +
      "Call this tool after log_meal when the user confirms they want to save the recipe — " +
      "always show the inferred_ingredients list to the user as a preview before calling this tool. " +
      "Pass meal_id to link the recipe to the meal that was just logged (clears inferred_ingredients). " +
      'Do NOT call this tool for meals with fewer than 2 inferable ingredients (e.g. "a coffee"). ' +
      'Ingredient strings should include quantity and unit when mentioned (e.g. "60g harina de maíz", "1 huevo mediano").',
    inputSchema: z.object({
      name: z.string().min(1).max(200)
        .describe('Dish name as the user described it.'),
      description: z.string()
        .describe("Short description reflecting the user's version of the dish."),
      ingredients: z.array(z.string()).min(2)
        .describe('List of ingredient strings. Include quantities/units when known.'),
      instructions: z.array(z.string()).default([])
        .describe('Preparation steps if inferable. Empty array is acceptable.'),
      language: z.enum(['es', 'en']).default('es')
        .describe('Language of the recipe content. Match the language the user wrote in.'),
      meal_id: z.uuid().optional()
        .describe(
          'UUID of the meal_log to link this recipe to. ' +
          'When provided, recipe_ids on that meal is updated and inferred_ingredients is cleared.',
        ),
    }),
    execute: async ({ name, description, ingredients, instructions, language, meal_id }) => {
      const supabase = await createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) return { success: false, error: 'Unauthorized' };

      // Save the recipe
      const { data: recipe, error: recipeError } = await supabase
        .from('recipes')
        .insert({ user_id: user.id, name, description, ingredients, instructions, language })
        .select('id')
        .single();

      if (recipeError) return { success: false, error: recipeError.message };

      // If meal_id provided, link the recipe and clear inferred_ingredients
      if (meal_id) {
        const { data: meal, error: fetchError } = await supabase
          .from('meal_logs')
          .select('recipe_ids, nutrition')
          .match({ id: meal_id, user_id: user.id })
          .single();

        if (!fetchError && meal) {
          const updatedRecipeIds = [...(meal.recipe_ids ?? []), recipe.id];
          const updatedNutrition = meal.nutrition
            ? { ...meal.nutrition, portion_confidence: 'from_recipe' }
            : null;

          await supabase
            .from('meal_logs')
            .update({
              recipe_ids: updatedRecipeIds,
              inferred_ingredients: null,
              ...(updatedNutrition ? { nutrition: updatedNutrition } : {}),
            })
            .match({ id: meal_id, user_id: user.id });
        }
      }

      revalidatePath('/dashboard');
      return {
        success: true,
        recipe_id: recipe.id,
        name,
        ingredient_count: ingredients.length,
        linked_to_meal: meal_id ?? null,
      };
    },
  });

  // ---------------------------------------------------------------------------
  // deleteMealTool
  // ---------------------------------------------------------------------------
  const deleteMealTool = tool({
    description:
      'Delete a specific meal log entry by ID. ' +
      'IMPORTANT: only call this tool AFTER you have shown the user the exact meal entry ' +
      'you intend to delete (log_text + time) and received their explicit confirmation. ' +
      'Never guess the meal_id — always retrieve it via get_meals first.',
    inputSchema: z.object({
      meal_id: z.uuid()
        .describe('UUID of the meal_log entry to delete. Must be obtained from get_meals.'),
    }),
    execute: async ({ meal_id }) => {
      const supabase = await createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) return { success: false, error: 'Unauthorized' };

      const { error } = await supabase
        .from('meal_logs')
        .delete()
        .match({ id: meal_id, user_id: user.id });

      if (error) return { success: false, error: error.message };

      revalidatePath('/dashboard');
      return { success: true };
    },
  });

  // ---------------------------------------------------------------------------
  // updateMealTool
  // ---------------------------------------------------------------------------
  const updateMealTool = tool({
    description:
      'Update a specific meal log entry by ID. ' +
      'Use recipe_id to link an existing recipe after the user confirms a recipe_suggestion preview. ' +
      'Use nutrition_patch to correct inferred portion servings when the user says the amounts are wrong. ' +
      'For text/type edits: show the user current values and proposed change, get explicit confirmation first. ' +
      'Never guess the meal_id — always retrieve it via get_meals first. ' +
      'At least one field must be provided.',
    inputSchema: z.object({
      meal_id: z.uuid()
        .describe('UUID of the meal_log entry to update. Must be obtained from get_meals or log_meal.'),
      log_text: z.string().min(1).max(500).optional()
        .describe('New description for the meal. Omit to keep unchanged.'),
      meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional()
        .describe('New meal type. Omit to keep unchanged.'),
      recipe_id: z.uuid().optional()
        .describe('Existing recipe UUID to link to this meal. Appended to recipe_ids.'),
      nutrition_patch: z.object({
        servings: z.partialRecord(ServingCategoryEnum, z.number().int().min(0)).optional()
          .describe('Partial servings update. Merges with existing; value 0 removes that category (sparse).'),
      }).optional()
        .describe("Partial update to nutrition when user corrects inferred portions. Sets portion_confidence to 'stated'."),
    }).refine(
      (d) =>
        d.log_text !== undefined ||
        d.meal_type !== undefined ||
        d.recipe_id !== undefined ||
        d.nutrition_patch !== undefined,
      { message: 'At least one of log_text, meal_type, recipe_id, or nutrition_patch must be provided.' },
    ),
    execute: async ({ meal_id, log_text, meal_type, recipe_id, nutrition_patch }) => {
      const supabase = await createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) return { success: false, error: 'Unauthorized' };

      // Build the update payload
      const updates: Record<string, unknown> = {};
      if (log_text  !== undefined) updates.log_text  = log_text;
      if (meal_type !== undefined) updates.meal_type = meal_type;

      // Recipe linking: fetch existing recipe_ids, append
      if (recipe_id !== undefined) {
        const { data: meal } = await supabase
          .from('meal_logs')
          .select('recipe_ids, nutrition')
          .match({ id: meal_id, user_id: user.id })
          .single();

        if (meal) {
          const existing = meal.recipe_ids ?? [];
          if (!existing.includes(recipe_id)) {
            updates.recipe_ids = [...existing, recipe_id];
            updates.inferred_ingredients = null;
            if (meal.nutrition) {
              updates.nutrition = { ...meal.nutrition, portion_confidence: 'from_recipe' };
            }
          }
        }
      }

      // Nutrition patch: merge sparse servings, set portion_confidence to 'stated'
      if (nutrition_patch !== undefined) {
        const { data: meal } = await supabase
          .from('meal_logs')
          .select('nutrition')
          .match({ id: meal_id, user_id: user.id })
          .single();

        if (meal?.nutrition) {
          const existing = meal.nutrition as Record<string, unknown>;
          const existingServings = (existing.servings ?? {}) as Record<string, number>;
          const patchServings    = nutrition_patch.servings ?? {};

          // Merge: apply patch values; remove any set to 0 (keep sparse)
          const mergedServings: Record<string, number> = { ...existingServings };
          for (const [cat, val] of Object.entries(patchServings)) {
            if (val === 0) {
              delete mergedServings[cat];
            } else {
              mergedServings[cat] = val as number;
            }
          }

          updates.nutrition = {
            ...existing,
            servings: mergedServings,
            portion_confidence: 'stated',
          };
        }
      }

      if (Object.keys(updates).length === 0) {
        return { success: false, error: 'Meal not found or no fields to update.' };
      }

      const { error } = await supabase
        .from('meal_logs')
        .update(updates)
        .match({ id: meal_id, user_id: user.id });

      if (error) return { success: false, error: error.message };

      revalidatePath('/dashboard');
      return { success: true, meal_id, updated: Object.keys(updates) };
    },
  });

  // ---------------------------------------------------------------------------
  // getDailySummaryTool
  // ---------------------------------------------------------------------------
  const getDailySummaryTool = tool({
    description:
      "Fetch a structured nutrition summary for the user's meals vs. their diet targets. " +
      'Use this for recommendations ("what should I eat next?") and compliance checks ("how am I doing today?"). ' +
      'Do NOT use get_meals for these — use this tool instead. ' +
      'The returned daily/weekly objects show consumed vs. target per category so you can identify gaps directly from numbers. ' +
      'For "what did I eat?" queries that need human-readable descriptions, use get_meals.',
    inputSchema: z.object({
      period: z.enum(['today', 'week']).default('today')
        .describe('today = current local day only; week = last 7 days including today.'),
      scope: z.enum(['individual', 'household', 'combined']).optional().default('combined')
        .describe(
          '"individual" = only the caller\'s own meals; ' +
          '"household" = shared household meals only; ' +
          '"combined" (default) = individual + household shared meals. ' +
          'For users with no household, always falls back to individual regardless of scope.',
        ),
    }),
    execute: async ({ period, scope }) => {
      console.log('getDailySummaryTool', { period, scope, tz });
      const supabase = await createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) return { error: 'Unauthorized' };

      const todayRange = getDateRange('today');

      // Resolve the user's household (needed for household/combined scopes)
      const { data: membership } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();
      const householdId = membership?.household_id ?? null;

      // Pre-fetch dismissed shared meal IDs so household/combined queries exclude them.
      // RLS already enforces this exclusion, but we filter explicitly for defence-in-depth.
      let dismissedMealIds: string[] = [];
      if (householdId && scope !== 'individual') {
        const { data: dismissed } = await supabase
          .from('meal_participants')
          .select('meal_log_id')
          .eq('user_id', user.id)
          .eq('dismissed', true);
        dismissedMealIds = (dismissed ?? []).map((d) => d.meal_log_id as string);
      }

      const fetchMeals = async (rangeStart: string, rangeEnd: string) => {
        let query = supabase
          .from('meal_logs')
          .select('meal_type, nutrition, eaten_at')
          .gte('eaten_at', rangeStart)
          .lte('eaten_at', rangeEnd)
          .order('eaten_at', { ascending: true });

        if (!householdId || scope === 'individual') {
          query = query.eq('user_id', user.id);
        } else if (scope === 'household') {
          query = query.eq('is_shared', true).eq('household_id', householdId);
        } else {
          // combined: own meals OR shared meals from household
          query = query.or(`user_id.eq.${user.id},and(is_shared.eq.true,household_id.eq.${householdId})`);
        }

        // Exclude meals the user has dismissed
        if (dismissedMealIds.length > 0) {
          query = query.not('id', 'in', `(${dismissedMealIds.join(',')})`);
        }

        const { data } = await query;
        return data ?? [];
      };

      // Fetch profile and meals in parallel.
      // When period='week', fetch the full 7-day window; today's meals are derived
      // by JS filtering to avoid a second DB call.
      const weekRange = period === 'week' ? getDateRange('week') : null;
      const [{ data: profileRow }, fetchedMeals] = await Promise.all([
        supabase
          .from('user_diet_profiles')
          .select('daily_targets, weekly_targets, restrictions')
          .eq('user_id', user.id)
          .single(),
        weekRange
          ? fetchMeals(weekRange.rangeStart, weekRange.rangeEnd)
          : fetchMeals(todayRange.rangeStart, todayRange.rangeEnd),
      ]);

      const weekMeals  = fetchedMeals;
      const todayMeals = weekRange
        ? fetchedMeals.filter(m => (m.eaten_at as string) >= todayRange.rangeStart)
        : fetchedMeals;

      const dailyTargets  = (profileRow?.daily_targets  ?? {}) as Record<string, { min?: number; max?: number }>;
      const weeklyTargets = (profileRow?.weekly_targets ?? {}) as Record<string, { min?: number; max?: number }>;
      const restrictions  = (profileRow?.restrictions   ?? {
        no_repeat_hours: 48,
        occasional_foods: [],
        protein_rotation: [],
      }) as { no_repeat_hours: number; occasional_foods: string[]; protein_rotation: string[] };

      // Aggregate sparse servings across a set of meals
      const aggregateServings = (meals: typeof todayMeals) => {
        const totals: Record<string, number> = {};
        for (const meal of meals) {
          const servings = (meal.nutrition as Record<string, unknown> | null)?.servings as
            Record<string, number> | undefined;
          if (!servings) continue;
          for (const [cat, count] of Object.entries(servings)) {
            totals[cat] = (totals[cat] ?? 0) + (count as number);
          }
        }
        return totals;
      };

      const todayServings = aggregateServings(todayMeals);
      const weekServings  = aggregateServings(weekMeals);

      // Build consumed-vs-target objects (only categories that have a target OR were consumed)
      const buildComparison = (
        servings: Record<string, number>,
        targets: Record<string, { min?: number; max?: number }>,
      ) => {
        const allKeys = new Set([...Object.keys(servings), ...Object.keys(targets)]);
        const result: Record<string, { consumed: number; min?: number; max?: number }> = {};
        for (const key of allKeys) {
          result[key] = {
            consumed: servings[key] ?? 0,
            ...(targets[key]?.min !== undefined ? { min: targets[key].min } : {}),
            ...(targets[key]?.max !== undefined ? { max: targets[key].max } : {}),
          };
        }
        return result;
      };

      // Per-meal food groups and protein types
      const mealsSummary = todayMeals.map(m => {
        const n = m.nutrition as Record<string, unknown> | null;
        return {
          meal_type:    m.meal_type as string,
          food_groups:  (n?.food_groups as string[] | undefined) ?? [],
          protein_type: (n?.protein_type as string | null | undefined) ?? null,
        };
      });

      const proteinTypesThisWeek = [
        ...new Set(
          weekMeals
            .map(m => (m.nutrition as Record<string, unknown> | null)?.protein_type as string | null)
            .filter((p): p is string => Boolean(p)),
        ),
      ];

      return {
        period,
        meals_logged: todayMeals.length,
        daily: buildComparison(todayServings, dailyTargets),
        weekly: period === 'week'
          ? buildComparison(weekServings, weeklyTargets)
          : undefined,
        meals: mealsSummary,
        protein_types_this_week: proteinTypesThisWeek,
        restrictions,
      };
    },
  });

  return {
    getMealsTool,
    logMealTool,
    formLogMealTool,
    saveRecipeTool,
    deleteMealTool,
    updateMealTool,
    getDailySummaryTool,
  };
}

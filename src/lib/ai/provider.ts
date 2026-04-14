import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Returns the configured AI language model based on PLENISH_AI_PROVIDER env var.
 * Defaults to Google Gemini Flash.
 *
 * Supported values:
 *   - "google"    → gemini-2.5-flash (default)
 *   - "openai"    → gpt-4o-mini
 */
export function getAIModel(): LanguageModel {
  const provider = process.env.PLENISH_AI_PROVIDER ?? 'google';

  switch (provider) {
    case 'openai': {
      const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
      return openai('gpt-4o-mini');
    }
    case 'google':
    default: {
      const google = createGoogleGenerativeAI({
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      });
      return google('gemini-2.5-flash');
    }
  }
}

// ---------------------------------------------------------------------------
// Diet profile types (mirrors user_diet_profiles table)
// ---------------------------------------------------------------------------

interface ServingTarget { min?: number; max?: number }

interface HouseholdContext {
  household_id: string;
  household_name: string;
  role: 'admin' | 'member';
  co_member_ids: string[];
}

interface DietProfile {
  daily_targets:  Record<string, ServingTarget>;
  weekly_targets: Record<string, ServingTarget>;
  restrictions: {
    no_repeat_hours: number;
    occasional_foods: string[];
    protein_rotation: string[];
  };
  serving_sizes: Record<string, { category: string; count: number }>;
}

// Nestle Menu Planner defaults — used when no DB profile exists yet.
const DEFAULT_PROFILE: DietProfile = {
  daily_targets: {
    dairy:     { min: 2, max: 4 },
    fruit_veg: { min: 4, max: 5 },
    grains:    { min: 4, max: 6 },
    olive_oil: { min: 3, max: 6 },
    water:     { min: 4, max: 8 },
  },
  weekly_targets: {
    fish:    { min: 3 },
    legumes: { min: 3 },
    meat:    { max: 4 },
    eggs:    { max: 4 },
    nuts:    { min: 3, max: 7 },
  },
  restrictions: {
    no_repeat_hours: 48,
    occasional_foods: ['sweets', 'pastries', 'soft drinks', 'sausages', 'cold cuts'],
    protein_rotation: ['white_meat', 'legumes', 'fish_blue', 'fish_white', 'red_meat'],
  },
  serving_sizes: {
    arepa:          { category: 'grains',      count: 1 },
    huevo:          { category: 'eggs',        count: 1 },
    queso:          { category: 'dairy',       count: 1 },
    pollo:          { category: 'meat',        count: 1 },
    'carne molida': { category: 'meat',        count: 1 },
    pasta:          { category: 'grains',      count: 1 },
    arroz:          { category: 'grains',      count: 1 },
    cuscus:         { category: 'grains',      count: 1 },
    brocoli:        { category: 'vegetables',  count: 1 },
    champinones:    { category: 'vegetables',  count: 1 },
    mandarina:      { category: 'fruit',       count: 1 },
    anchoas:        { category: 'fish',        count: 1 },
    salmon:         { category: 'fish',        count: 1 },
    pipas:          { category: 'nuts',        count: 1 },
    lentejas:       { category: 'legumes',     count: 1 },
    garbanzos:      { category: 'legumes',     count: 1 },
  },
};

// ---------------------------------------------------------------------------
// getSystemPrompt — async, loads diet profile from DB
// ---------------------------------------------------------------------------

export async function getSystemPrompt(
  tzOffsetMinutes: number,
  userId: string,
  supabase: SupabaseClient,
): Promise<string> {
  // Resolve current local time for the user
  const serverNow = new Date();
  const localMs   = serverNow.getTime() - tzOffsetMinutes * 60_000;
  const localNow  = new Date(localMs);
  const dateStr   = localNow.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  });
  const timeStr = localNow.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  });

  // Load diet profile and household membership in parallel
  const [{ data: profileRow }, { data: membershipRow }] = await Promise.all([
    supabase
      .from('user_diet_profiles')
      .select('daily_targets, weekly_targets, restrictions, serving_sizes')
      .eq('user_id', userId)
      .single(),
    supabase
      .from('household_members')
      .select('household_id, role, households(name, id)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle(),
  ]);

  const profile: DietProfile = profileRow
    ? {
        daily_targets:  profileRow.daily_targets  as DietProfile['daily_targets'],
        weekly_targets: profileRow.weekly_targets as DietProfile['weekly_targets'],
        restrictions:   profileRow.restrictions   as DietProfile['restrictions'],
        serving_sizes:  profileRow.serving_sizes  as DietProfile['serving_sizes'],
      }
    : DEFAULT_PROFILE;

  // Fetch active co-members if the user is in a household
  let householdContext: HouseholdContext | null = null;
  if (membershipRow) {
    const household = membershipRow.households as unknown as { name: string; id: string } | null;
    if (household) {
      const { data: members } = await supabase
        .from('household_members')
        .select('user_id, role')
        .eq('household_id', household.id)
        .eq('status', 'active')
        .neq('user_id', userId);

      householdContext = {
        household_id: household.id,
        household_name: household.name,
        role: membershipRow.role as 'admin' | 'member',
        co_member_ids: (members ?? []).map((m) => m.user_id as string),
      };
    }
  }

  return buildSystemPrompt(`${dateStr} at ${timeStr}`, profile, householdContext);
}

// ---------------------------------------------------------------------------
// buildSystemPrompt — injects diet profile values dynamically
// ---------------------------------------------------------------------------

function formatDietProfile(profile: DietProfile): string {
  const fmt = (targets: Record<string, ServingTarget>) =>
    Object.entries(targets)
      .map(([cat, t]) => {
        if (t.min !== undefined && t.max !== undefined) return `${cat} ${t.min}–${t.max}`;
        if (t.min !== undefined) return `${cat} ≥${t.min}`;
        return `${cat} ≤${t.max!}`;
      })
      .join(', ');

  return `Daily: ${fmt(profile.daily_targets)} servings\nWeekly: ${fmt(profile.weekly_targets)} servings`;
}

function formatPortionDefaults(sizes: Record<string, { category: string }>): string {
  return Object.entries(sizes)
    .map(([food, { category }]) => `${food} → ${category}`)
    .join(' | ');
}

function buildSystemPrompt(dateLine: string, profile: DietProfile, household: HouseholdContext | null = null): string {
  const householdSection = household
    ? `# Household

ID: ${household.household_id} | Role: ${household.role} | Co-members: ${household.co_member_ids.length > 0 ? household.co_member_ids.join(', ') : 'none'}
"nosotros"/"comimos"/"en casa" → is_shared=true, co_eater_ids=[${household.co_member_ids.join(', ')}]
"solo yo"/"just me" → is_shared=false
get_daily_summary default: combined. "Solo para mí" → individual. "Para todos" → household.`
    : `# Household

No household — use individual scope for all summaries and recommendations.`;

  return `Today: ${dateLine}

You are an AI meal tracker and planner. Be concise and practical.

Goal: recommend meals that fill nutritional gaps toward daily/weekly targets, based on what the user has eaten and their preferences.

# Diet Profile

${formatDietProfile(profile)}

# Meal Rules

These are guidelines for **recommendations only** — never block, question, or delay logging a meal because it doesn't follow them. Always log what the user says they ate, exactly as described.

- Lunch/dinner must cover 3 groups: Vitaminas (vegetables, fruit, greens) + Proteínas (meat, fish, eggs, legumes) + Hidratos (pasta, potato, rice; prefer whole grain)
- Breakfast: 1 dairy + 1 fruit + 1 whole grain
- Snack: dairy + fruit OR small sandwich
- Protein rotation (weekly cycle): ${profile.restrictions.protein_rotation.join(' → ')}
- No same dish within ${profile.restrictions.no_repeat_hours}h
- Occasional only: ${profile.restrictions.occasional_foods.join(', ')}

# User Preferences

Respond in the user's language (Spanish or English). Spanish/Latin cuisine preferred.

# Portion Defaults (1 serving when qty omitted; for unlisted foods, infer closest category)

${formatPortionDefaults(profile.serving_sizes)}

# Tools

## log_meal
- Strip UI prefixes: [date: YYYY-MM-DD] → eaten_at=YYYY-MM-DDT12:00:00.000Z, [meal_type] → meal_type. Exclude prefixes from log_text. No date → now.
- Infer: food_groups, protein_type, servings, has_occasional_food, portion_confidence, inferred_ingredients.
- After logging: reply with a single short confirmation only (e.g. "✓ Desayuno registrado."). No summaries, no gap analysis, no recommendations unless the user explicitly asks.

## get_daily_summary
For recommendations and compliance. Returns consumed vs targets. Use period="week" for protein rotation and weekly targets.

## get_meals
For displaying meal history only. Never for recommendations.

## Recommend
1. get_daily_summary("today"), optionally "week"
2. Identify gaps from consumed vs targets
3. Suggest a meal filling them; explain briefly

## Delete / Edit
get_meals → show candidate → user confirms → delete_meal or update_meal. Never modify without confirmation. Only update mentioned fields.

${householdSection}`;
}

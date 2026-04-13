import { tool } from 'ai';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { planSingleSlot, planWeekSlots, getPlannedMeals } from '@/actions/plans';
import type { MealType } from '@/actions/meals';

const MEAL_TYPES: MealType[] = ['breakfast', 'snack', 'lunch', 'dinner'];

function getWeekBounds(): { start: string; end: string } {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const dow = now.getDay(); // 0=Sun, 1=Mon...
  const daysToSunday = dow === 0 ? 0 : 7 - dow;
  const sunday = new Date(now);
  sunday.setDate(now.getDate() + daysToSunday);
  return { start: today, end: sunday.toISOString().split('T')[0] };
}

export const planMealsTool = tool({
  description:
    'Generate and save AI meal recommendations for specific slots or the rest of the current week. ' +
    'Use this when the user asks to plan meals, get suggestions for specific days/meal types, or fill their week with meal ideas. ' +
    'Trigger phrases: "plan my week", "plan dinner for Thursday", "suggest something for lunch on Friday", ' +
    '"planifica mi semana", "qué debería comer el jueves", "sugiere algo para el viernes".',
  inputSchema: z.object({
    slots: z
      .array(
        z.object({
          mealType: z.enum(['breakfast', 'snack', 'lunch', 'dinner']),
          date: z.string().describe('YYYY-MM-DD'),
        }),
      )
      .optional()
      .describe(
        'Specific slots to plan. If omitted, plans all remaining empty slots in the current week.',
      ),
    regenerate: z
      .boolean()
      .optional()
      .describe('If true, replace any existing pending plan for the given slots.'),
  }),
  execute: async ({ slots, regenerate }) => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Unauthorized' };

    // ── Specific slots provided ──────────────────────────────────────────────
    if (slots && slots.length > 0) {
      if (regenerate) {
        for (const slot of slots) {
          await supabase
            .from('planned_meals')
            .update({ status: 'dismissed' })
            .eq('user_id', user.id)
            .eq('meal_type', slot.mealType)
            .eq('planned_date', slot.date)
            .eq('status', 'planned');
        }
      }

      if (slots.length === 1) {
        const planned = await planSingleSlot(
          slots[0].mealType as MealType,
          slots[0].date,
        );
        return {
          planned: [planned],
          summary: `Planned: **${planned.name}** for ${slots[0].mealType} on ${slots[0].date}. ${planned.description ?? ''}`,
        };
      }

      const planned = await planWeekSlots(
        slots.map(s => ({ mealType: s.mealType as MealType, date: s.date })),
      );
      return {
        planned,
        summary: `Planned ${planned.length} meals: ${planned.map(p => `${p.name} (${p.meal_type} ${p.planned_date})`).join(', ')}.`,
      };
    }

    // ── No specific slots — fill rest of current week ────────────────────────
    const { start, end } = getWeekBounds();

    const [existingPlans, loggedResult] = await Promise.all([
      getPlannedMeals(start, end),
      supabase
        .from('meal_logs')
        .select('meal_type, eaten_at')
        .eq('user_id', user.id)
        .gte('eaten_at', `${start}T00:00:00.000Z`)
        .lte('eaten_at', `${end}T23:59:59.999Z`),
    ]);

    const plannedKeys = new Set(existingPlans.map(p => `${p.planned_date}-${p.meal_type}`));
    const loggedKeys = new Set(
      (loggedResult.data ?? []).map(m => {
        const date = new Date(m.eaten_at as string).toISOString().split('T')[0];
        return `${date}-${m.meal_type}`;
      }),
    );

    const emptySlots: { mealType: MealType; date: string }[] = [];
    const cursor = new Date(`${start}T12:00:00Z`);
    const endDate = new Date(`${end}T12:00:00Z`);

    while (cursor <= endDate) {
      const dateStr = cursor.toISOString().split('T')[0];
      for (const mealType of MEAL_TYPES) {
        const key = `${dateStr}-${mealType}`;
        if (!plannedKeys.has(key) && !loggedKeys.has(key)) {
          emptySlots.push({ mealType, date: dateStr });
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    if (emptySlots.length === 0) {
      return {
        planned: [],
        summary: 'Tu semana ya está completamente planificada — no hay slots vacíos.',
      };
    }

    const planned = await planWeekSlots(emptySlots);
    return {
      planned,
      summary: `Planifiqué ${planned.length} comidas: ${planned
        .map(p => `**${p.name}** (${p.meal_type} del ${p.planned_date})`)
        .join(', ')}.`,
    };
  },
});

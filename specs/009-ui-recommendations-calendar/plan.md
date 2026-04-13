# Phase 6 (009): Recommendations Calendar — Plan

**Branch**: `009-ui-recommendations-calendar` | **Depends on**: Phase 2 (005 — Calendar)

---

## Design decisions (updated after review)

### Separate table, not a status flag on meal_logs

`meal_logs` = things actually eaten — clean, audit-quality.  
`planned_meals` = AI suggestions, many will never be acted on → different schema, different lifetime.  
Mixing them pollutes queries like "what did I eat this week?" with unacted suggestions.

### No hard deletes — keep history for learning

Every recommendation that was dismissed, overridden, or regenerated is kept with a status.  
Over time this builds signal: "user has been recommended ratatouille 3× and never accepted it."  
Phase 009 stores the data. A future phase feeds it back into the system prompt.

### No UNIQUE constraint on (user_id, meal_type, planned_date)

Multiple recommendations can exist per slot (history of regenerations).  
Active recommendation = the latest row with `status = 'planned'`.  
When regenerating: mark old row `dismissed` → insert new `planned` row.

### Auto-clear when a real meal is logged

When `logMeal` succeeds: soft-mark any `status = 'planned'` recommendation for the same
`(user_id, meal_type, date)` as `overridden`, storing the new `meal_log.id`.  
No user action required — it happens automatically.

### On-demand only, no auto-generation on page load

`RecommendationFetcher` / `CurrentRecommendation` are deleted.  
Recommendations only happen when the user explicitly asks.

### Override / regenerate a pending slot

Planned cells show a **↻ Regenerate** button (functional, not disabled) in addition to
Accept and Dismiss. Clicking it: dismiss current → generate new for same slot → refresh.  
Via chat: "suggest something different for dinner on Friday" → `plan_meals` tool with regenerate intent.

### "Plan Week" skips slots that already have a pending plan

"Plan Week" fills only truly empty slots (no logged meal AND no pending plan).  
Individual slot regeneration goes through the ↻ button or chat.

---

## DB: `planned_meals` table (migration `00007`)

```sql
CREATE TABLE public.planned_meals (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  meal_type            text NOT NULL CHECK (meal_type IN ('breakfast','snack','lunch','dinner')),
  planned_date         date NOT NULL,
  name                 text NOT NULL,
  description          text,
  reason               text,
  ingredients          text[],
  prep_time_minutes    int,
  estimated_calories   int,

  -- Lifecycle status
  status               text NOT NULL DEFAULT 'planned'
                         CHECK (status IN ('planned','accepted','dismissed','overridden','expired')),

  -- Learning links
  accepted_meal_id     uuid REFERENCES public.meal_logs(id) ON DELETE SET NULL,
  overridden_meal_id   uuid REFERENCES public.meal_logs(id) ON DELETE SET NULL,

  created_at           timestamptz NOT NULL DEFAULT now()
  -- No UNIQUE constraint — multiple rows per slot allowed for history
);

-- Efficient query: latest active plan per slot
CREATE INDEX planned_meals_active_idx
  ON public.planned_meals (user_id, planned_date, meal_type, status)
  WHERE status = 'planned';

-- RLS: users manage their own rows only
ALTER TABLE public.planned_meals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "planned_meals: select own" ON public.planned_meals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "planned_meals: insert own" ON public.planned_meals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "planned_meals: update own" ON public.planned_meals FOR UPDATE USING (auth.uid() = user_id);
```

### Status lifecycle

```
planned ──► accepted    user clicked Accept (+ real meal logged)
        ──► dismissed   user clicked ↻ Regenerate or explicit Dismiss
        ──► overridden  user logged a different meal for this slot (auto)
        ──► expired     past date, never acted on (marked lazily on read)
```

---

## Status: auto-clear when a real meal is logged

In `logMeal` server action, after successful insert:

```ts
// Soft-mark any active plan for this slot as overridden
await supabase
  .from('planned_meals')
  .update({ status: 'overridden', overridden_meal_id: newMealLogId })
  .eq('user_id', userId)
  .eq('meal_type', mealType)
  .eq('planned_date', mealDate)   // YYYY-MM-DD derived from eaten_at
  .eq('status', 'planned');
```

No user action needed — the plan silently clears when they log something real.

---

## AI schema additions (`src/lib/ai/getRecommendation.ts`)

**Single slot** — extend existing `RecommendationSchema` (add `targetDate` field, pass slot in prompt).

**Week plan** — new `WeekPlanSchema`:
```ts
z.object({
  meals: z.array(RecommendationSchema.extend({
    date:     z.string(),   // YYYY-MM-DD — echoed back from the prompt
    mealType: z.enum(['breakfast','snack','lunch','dinner']),
  }))
})
```
One prompt listing all empty slots → model fills them all in one call.

**Learning context** (Phase 009 scope: collect the data, surface it in the planning prompt):
```ts
// In planSingleSlot / planWeekSlots — include in the prompt:
const rejectedSummary = await getTopRejectedMeals(userId, limit=5);
// "Meals this user has repeatedly dismissed or overridden: ratatouille (×3), pasta carbonara (×2)"
```
Future phase: feed this into `getSystemPrompt` for the main chat as well.

---

## Server actions: `src/actions/plans.ts`

```ts
getPlannedMeals(weekStart: string, weekEnd: string): Promise<PlannedMeal[]>
  // DB read, status='planned' only, no AI call

planSingleSlot(mealType: MealType, date: string): Promise<PlannedMeal>
  // 1 AI call → insert → revalidatePath('/dashboard') → return

planWeekSlots(slots: { mealType: MealType; date: string }[]): Promise<PlannedMeal[]>
  // 1 AI call (WeekPlanSchema) → bulk insert → revalidatePath → return

regenerateSlot(existingId: string, mealType: MealType, date: string): Promise<PlannedMeal>
  // mark existingId as dismissed → planSingleSlot (reuses) → return

dismissPlannedMeal(id: string): Promise<void>
  // status = 'dismissed'

acceptPlannedMeal(id: string, mealLogId: string): Promise<void>
  // status = 'accepted', accepted_meal_id = mealLogId
```

---

## Files

### Create
- `supabase/migrations/00007_planned_meals.sql`
- `src/actions/plans.ts`

### Modify
- `src/lib/ai/getRecommendation.ts` — `generateWeekPlan()` + learning context helper
- `src/actions/meals.ts` — auto-clear planned meal on `logMeal`
- `src/app/api/chat/route.ts` — add `plan_meals` tool
- `src/components/specific/MealCalendar.tsx` — fetch `getPlannedMeals` for week
- `src/components/ui/MealWeekGrid.tsx` — planned cell + empty cell button + Plan Week button
- `src/components/specific/MealLogger.tsx` — `initialMealType?`, `initialText?`, `initialDate?`
- `src/components/specific/LogMealFormWrapper.tsx` — forward prefill props
- `src/app/dashboard/page.tsx` — read `searchParams`, remove `recommendationSlot`
- `src/app/dashboard/DashboardLayout.tsx` — remove `recommendationSlot`

### Delete
- `src/components/specific/CurrentRecommendation.tsx`
- `src/components/specific/RecommendationFetcher.tsx`

---

## Calendar UX

### Empty cell (no meal, no plan, future date)
```
┌                     ┐
           +               tiny icon, hover tooltip "Plan this meal"
└                     ┘
```

### Planned cell
```
┌ - - - - - - - - - - ┐   dashed border in MEAL_COLOR[type] at 40% opacity
  Bowl de Quinoa…          name, 2-line clamp, muted
  [✓] [↻] [✕]             Accept / Regenerate / Dismiss
└ - - - - - - - - - - ┘
  background: MEAL_BG at ~50% opacity (lighter than logged cells)
```

- **Accept** → `router.push('/dashboard?prefillType=...&prefillText=...&prefillDate=...')`  
  + calls `acceptPlannedMeal(id)` (fire-and-forget, doesn't block navigation)
- **↻ Regenerate** → `regenerateSlot(id, mealType, date)` → loading state → refresh
- **✕ Dismiss** → `dismissPlannedMeal(id)` → optimistic removal from local state

### "Plan Week" button (calendar header, right side)
- Only active when current week view includes today or future dates
- Computes: `emptyFutureSlots` = all (mealType × date ≥ today) with no logged meal and no planned meal
- If none: shows brief "Nothing to plan — week is full" toast
- Else: `planWeekSlots(emptyFutureSlots)` → spinner on button → `router.refresh()`

---

## MealLogger prefill (Accept flow)

URL params: `/dashboard?prefillType=dinner&prefillText=Bowl+de+Quinoa...&prefillDate=2026-04-14`

`page.tsx` reads `searchParams`:
```ts
export default async function DashboardPage({ searchParams }: { searchParams: Promise<...> }) {
  const params = await searchParams;
  // pass prefillType / prefillText / prefillDate to LogMealFormWrapper
}
```

`MealLogger` new props: `initialMealType?`, `initialText?`, `initialDate?`  
On mount with `initialText`: focus input, pre-select chip, pre-set date chip.  
After mount: `router.replace('/dashboard')` to clear params from URL.

---

## Chat: `plan_meals` tool

Added to `chat/route.ts`:

```ts
plan_meals: tool({
  description: 'Generate and save meal recommendations for specific slots or the current week.',
  parameters: z.object({
    slots: z.array(z.object({
      mealType: z.enum(['breakfast','snack','lunch','dinner']),
      date: z.string(),   // YYYY-MM-DD
    })).optional().describe('Specific slots to plan. If omitted, plans the rest of the current week.'),
    regenerate: z.boolean().optional().describe('If true, replace any existing plan for the given slots.'),
  }),
  execute: async ({ slots, regenerate }) => {
    // 1. Resolve empty slots if not specified
    // 2. If regenerate: dismiss existing planned rows first
    // 3. Call planWeekSlots(resolvedSlots) → saves to DB
    // 4. Return summary: "I've planned your meals for Mon–Thu: [list]"
  },
})
```

Trigger phrases: "plan my week", "qué debería comer el jueves", "sugiere algo para el viernes",
"plan dinner for tomorrow", "regenerate my lunch for Thursday".

---

## Task list (17 items, ~4-5 hours)

**Migration & data layer**
1. `00007_planned_meals.sql` — table + index + RLS
2. `src/actions/plans.ts` — all 6 server actions
3. `getRecommendation.ts` — `generateWeekPlan()` + `getTopRejectedMeals()`
4. `src/actions/meals.ts` — auto-clear planned meal inside `logMeal`

**Calendar**
5. `MealCalendar.tsx` — fetch `getPlannedMeals` for visible week range, pass to grid
6. `MealWeekGrid.tsx` — `plannedMeals` prop, `onPlanSlot` / `onRegenerateSlot` callbacks
7. Planned cell: dashed border variant, name label, Accept / Regenerate / Dismiss buttons
8. Empty cell "+" button → `onPlanSlot(mealType, date)` → loading → refresh
9. "Plan Week" button in header → compute empty slots → `planWeekSlots` → loading → refresh

**MealLogger prefill**
10. `MealLogger.tsx` — 3 new props, auto-focus `useEffect`, `router.replace` on mount
11. `LogMealFormWrapper.tsx` — accept + forward prefill props
12. `dashboard/page.tsx` — read `searchParams`, pass prefill down; remove `recommendationSlot`

**Chat tool**
13. `plan_meals` tool in `chat/route.ts`

**Cleanup**
14. Delete `CurrentRecommendation.tsx` + `RecommendationFetcher.tsx`
15. Remove `recommendationSlot` from `DashboardLayout`

**Testing**
16. Accept flow: chip + text + date pre-filled, URL cleared, `acceptPlannedMeal` called
17. Auto-clear: log a meal for a planned slot → planned cell disappears on refresh

---

## Out of scope (future phase)

- Full learning loop in main chat system prompt (needs enough historical data first)
- "Expired" batch job for past unacted plans
- Analytics UI ("your most accepted / most skipped meals")

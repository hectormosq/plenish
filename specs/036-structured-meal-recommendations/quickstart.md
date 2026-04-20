# Quickstart: Structured Meal Recommendations

**Branch**: `036-structured-meal-recommendations`

## Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/00009_planned_meals_instructions.sql` | New — add `instructions text` column |
| `docs/database_schema.md` | Update `planned_meals` table entry |
| `src/lib/ai/getRecommendation.ts` | Add `instructions` to `RecommendationSchema`; add `ingredientHint` param to `generateSinglePlan` |
| `src/actions/plans.ts` | Add `instructions` to `PlannedMeal` interface; store `instructions` in inserts; add `ingredientHint` param to `regenerateSlot` |
| `src/components/ui/MealWeekGrid.tsx` | Expand/collapse state; expanded cell UI; regen hint input UI |

## Implementation Order

1. **Migration** → `00009_planned_meals_instructions.sql`
2. **AI schema** → add `instructions` to `RecommendationSchema` and `generateSinglePlan` hint param
3. **Server action** → update `PlannedMeal` interface, inserts, `regenerateSlot` signature
4. **UI** → expand/collapse toggle + expanded view; regen hint input

## Verification

- Plan a single slot → `instructions` field populated in DB
- Expand planned meal cell → ingredients and instructions shown
- Collapse → name only
- Legacy cell (null instructions) → graceful fallback shown
- Tap regen → hint input appears; skip → regenerates without hint; provide hint → meal reflects it
- `npm run build` passes with zero type errors

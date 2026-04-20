# Data Model: Structured Meal Recommendations

**Branch**: `036-structured-meal-recommendations` | **Date**: 2026-04-17

## Schema Change

### Migration: `00009_planned_meals_instructions.sql`

```sql
ALTER TABLE public.planned_meals
  ADD COLUMN IF NOT EXISTS instructions text;
```

Non-breaking — existing rows get `NULL`. No index needed (not queried on).

---

## Updated Entity: PlannedMeal

| Field | Type | Status | Notes |
|-------|------|--------|-------|
| `id` | uuid | existing | |
| `user_id` | uuid | existing | |
| `meal_type` | text | existing | |
| `planned_date` | date | existing | |
| `name` | text | existing | |
| `description` | text \| null | existing | |
| `reason` | text \| null | existing | |
| `ingredients` | string[] \| null | existing | Already in DB and AI schema |
| `instructions` | string \| null | **NEW** | Free-text cooking steps |
| `prep_time_minutes` | int \| null | existing | |
| `estimated_calories` | int \| null | existing | |
| `status` | text | existing | |
| `accepted_meal_id` | uuid \| null | existing | |
| `overridden_meal_id` | uuid \| null | existing | |
| `created_at` | timestamptz | existing | |

---

## Updated AI Schema: RecommendationSchema (getRecommendation.ts)

Add one field:
```
instructions: z.string().describe("Step-by-step cooking instructions in 2-4 sentences")
```

---

## Client-Side State (MealWeekGrid)

| State | Type | Purpose |
|-------|------|---------|
| `expandedSlots` | `Set<string>` (new) | Tracks which planned meal IDs are expanded |
| `regenHintSlot` | `{ id, mealType, date } \| null` (new) | Tracks which slot is awaiting a hint input |

---

## Updated Action Signatures

| Function | Change |
|----------|--------|
| `regenerateSlot(id, mealType, date)` | Add optional `ingredientHint?: string` param |
| `generateSinglePlan(...)` | Add optional `ingredientHint?: string` param, append to prompt |

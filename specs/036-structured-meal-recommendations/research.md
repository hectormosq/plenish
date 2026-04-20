# Research: Structured Meal Recommendations with Ingredients and Instructions

**Branch**: `036-structured-meal-recommendations` | **Date**: 2026-04-17

---

## R-001: Scope Reduction — ingredients Already Exists

**Decision**: No migration needed for `ingredients`. The column, type, AI schema field, and storage code already exist end-to-end. Only `instructions` (free-text cooking steps) needs to be added.

**Finding**: `planned_meals` table has `ingredients text[]`; `PlannedMeal` interface has `ingredients: string[] | null`; `RecommendationSchema` has `ingredients: z.array(z.string()).max(8)`; `planSingleSlot` and `planWeekSlots` already insert `ingredients`.

**Scope**: Add `instructions text` column (one migration), add to `RecommendationSchema`, store it, display it.

---

## R-002: instructions Field Design

**Decision**: Add `instructions: z.string().describe("Step-by-step cooking instructions in 2-4 sentences")` to `RecommendationSchema` in `getRecommendation.ts`. Store as `text` in `planned_meals`. Add `instructions: string | null` to `PlannedMeal` interface.

**Rationale**: Free text is the right storage type — instructions are narrative, not structured. The Zod schema drives AI output shape via `Output.object()`.

**Alternatives considered**:
- `text[]` array of steps: more structured but adds parsing complexity for display; free text is sufficient for v1.

---

## R-003: Expand/Collapse UI on Planned Meal Cell

**Decision**: Add a local `expandedSlots: Set<string>` state in `MealWeekGrid`. A toggle button on each planned meal cell adds/removes the slot key. When expanded, render ingredients list and instructions below the meal name inside the existing `CellBody`.

**Rationale**: Purely client-side — no new requests. The data is already in `allPlannedMeals`. Using a `Set<string>` keyed by `planned.id` is the simplest approach.

**Alternatives considered**:
- Separate modal/drawer: more space for content but adds navigation complexity; the cell expansion is sufficient for an ingredient list.
- Persist expanded state: not needed — the spec explicitly says local UI session only.

---

## R-004: Ingredient Hint on Regenerate

**Decision**: Add an `ingredientHint?: string` parameter to `regenerateSlot` in `plans.ts`, forward it to `generateSinglePlan`, and include it in the prompt string as a soft constraint. In `MealWeekGrid`, replace the direct `regenerateSlot` call with a brief inline prompt: show a small input overlay on the regen button click, wait for confirm/skip, then call the action.

**Rationale**: The hint is ephemeral — it is only needed for the duration of one AI call. No DB storage required. The AI prompt already accepts free-text constraints.

**UI pattern**: A small popover/inline input that appears when the regen button is tapped, with a "Regenerate" confirm and a "Skip" option. Keeps the calendar compact.

**Alternatives considered**:
- Modal dialog: heavier UX for a single optional field.
- Always-visible hint field: clutters the compact calendar cell.

---

## R-005: Migration Strategy

**Decision**: Create `supabase/migrations/00009_planned_meals_instructions.sql` adding `instructions text` column to `planned_meals` with `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.

**Rationale**: Non-breaking — existing rows get `NULL`, which the UI handles gracefully via the "No details available" fallback.

# Tasks: Structured Meal Recommendations with Ingredients and Instructions

**Input**: Design documents from `/specs/036-structured-meal-recommendations/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, quickstart.md ✅

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)

---

## Phase 1: Setup

*(No setup tasks — project structure already exists)*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Migration and schema update MUST be complete before any code references `instructions`.

**⚠️ CRITICAL**: Constitution requires migration before code changes. No user story work until T001–T002 are done.

- [X] T001 Create `supabase/migrations/00009_planned_meals_instructions.sql` with `ALTER TABLE public.planned_meals ADD COLUMN IF NOT EXISTS instructions text;`
- [X] T002 Update `docs/database_schema.md` to add `instructions text` to the `planned_meals` table entry

**Checkpoint**: Migration file and schema doc updated — code changes can now begin.

---

## Phase 3: User Story 1 — View Ingredients and Instructions for a Planned Meal (Priority: P1) 🎯 MVP

**Goal**: After planning a meal, the user can expand the calendar cell to see ingredients and instructions.

**Independent Test**: Plan a slot, expand the cell, verify ingredients list and instructions text appear. Collapse it, verify only the meal name shows. Check a legacy cell (null instructions) shows graceful fallback.

### Implementation for User Story 1

- [X] T003 [US1] In `src/lib/ai/getRecommendation.ts`, add `instructions: z.string().describe("Step-by-step cooking instructions in 2-4 sentences")` to `RecommendationSchema` after the `ingredients` field
- [X] T004 [US1] In `src/actions/plans.ts`, add `instructions: string | null` to the `PlannedMeal` interface after the `ingredients` field
- [X] T005 [US1] In `src/actions/plans.ts`, add `instructions: recommendation.instructions ?? null` to the `supabase.from('planned_meals').insert(...)` call inside `planSingleSlot`
- [X] T006 [US1] In `src/actions/plans.ts`, add `instructions: recommendations[i].instructions ?? null` to each row object inside the `rows` array in `planWeekSlots`
- [X] T007 [US1] In `src/components/ui/MealWeekGrid.tsx`, add `expandedSlots: Set<string>` state with `useState<Set<string>>(new Set())` near the other state declarations
- [X] T008 [US1] In `src/components/ui/MealWeekGrid.tsx`, add a toggle handler `handleToggleExpand = (id: string) => setExpandedSlots(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; })`
- [X] T009 [US1] In `src/components/ui/MealWeekGrid.tsx`, add styled components: `ExpandToggle` (small icon button), `ExpandedContent` (wrapper div), `IngredientList` (ul), `InstructionsText` (p) — using dark background tones consistent with existing `CellBody` styling
- [X] T010 [US1] In `src/components/ui/MealWeekGrid.tsx`, update the planned meal cell JSX to: (a) add the `ExpandToggle` button next to the meal name that calls `handleToggleExpand(planned.id)`, (b) conditionally render `ExpandedContent` when `expandedSlots.has(planned.id)` showing ingredients as a list and instructions as a paragraph, with a "No details available" fallback when both are null

**Checkpoint**: US1 complete when cells expand/collapse and show ingredients + instructions from the DB.

---

## Phase 4: User Story 2 — Ingredient Hint on Regenerate (Priority: P2)

**Goal**: When tapping regenerate, an optional hint input appears. The hint is passed to the AI as a soft constraint.

**Independent Test**: Tap regen, enter "pollo y arroz", confirm — verify regenerated meal name/ingredients reflect the hint. Tap regen again, skip hint — verify regeneration works as before.

### Implementation for User Story 2

- [X] T011 [US2] In `src/lib/ai/getRecommendation.ts`, add optional `ingredientHint?: string` parameter to `generateSinglePlan`; append to the prompt string: `${ingredientHint ? `\n\nPreferred ingredients (soft constraint): ${ingredientHint}` : ''}`
- [X] T012 [US2] In `src/actions/plans.ts`, add optional `ingredientHint?: string` parameter to `regenerateSlot` and forward it to the `planSingleSlot` call; add `ingredientHint` parameter to `planSingleSlot` and forward it to `generateSinglePlan`
- [X] T013 [US2] In `src/components/ui/MealWeekGrid.tsx`, add `regenHintSlot: { id: string; mealType: MealType; date: string } | null` state with `useState(null)` and `regenHint: string` state with `useState('')`
- [X] T014 [US2] In `src/components/ui/MealWeekGrid.tsx`, add styled components: `HintOverlay` (small inline form that appears below the cell's action buttons), `HintInput` (text input), `HintConfirmBtn` and `HintSkipBtn` (small buttons)
- [X] T015 [US2] In `src/components/ui/MealWeekGrid.tsx`, update `handleRegenerate` to: instead of calling `regenerateSlot` directly, set `regenHintSlot` to `{ id, mealType, date }` and reset `regenHint` to `''`
- [X] T016 [US2] In `src/components/ui/MealWeekGrid.tsx`, add `handleRegenConfirm` that calls `regenerateSlot(regenHintSlot.id, regenHintSlot.mealType, regenHintSlot.date, regenHint || undefined)`, updates `allPlannedMeals`, then clears `regenHintSlot` and `regenHint`; add `handleRegenSkip` that calls `handleRegenConfirm` without a hint
- [X] T017 [US2] In `src/components/ui/MealWeekGrid.tsx`, render the `HintOverlay` inline inside the planned meal cell when `regenHintSlot?.id === planned.id`, containing the `HintInput`, `HintConfirmBtn` ("Regenerate"), and `HintSkipBtn` ("Skip")

**Checkpoint**: US2 complete when regen shows the hint input, hint is passed to AI, and skip works without hint.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T018 Run `npm run build` in repo root and confirm zero TypeScript errors
- [X] T019 [P] Verify plan a single slot → `instructions` column populated in DB (check Supabase dashboard or query)
- [X] T020 [P] Verify expand/collapse works on desktop and mobile viewports; verify legacy null cell shows fallback
- [X] T021 [P] Verify regen with hint and regen without hint both work end-to-end

---

## Dependencies & Execution Order

- **Foundational (Phase 2)**: T001 → T002 — must complete before any code changes
- **US1 (Phase 3)**: T003 → T004 → T005 → T006 (data layer, sequential same files) then T007 → T008 → T009 → T010 (UI layer)
- **US2 (Phase 4)**: Depends on T003 (shared `generateSinglePlan` signature); T011–T017 sequential (same files)
- **Polish (Phase 5)**: After T010 and T017

### Parallel Opportunities

- T003–T006 (AI + server layer) and T007–T010 (UI layer) — T007 can start after T004 since it's a different file
- T019, T020, T021 (polish verification) — fully parallel

---

## Parallel Example

```
# After T002 (foundation complete):
Thread A: T003 → T004 → T005 → T006   (getRecommendation.ts + plans.ts)
Thread B: T007 → T008 → T009 → T010   (MealWeekGrid.tsx — can start after T004)
# After Thread A completes: T011 → T012
# Merge + T013 → T014 → T015 → T016 → T017
# Then: T018 → T019/T020/T021 in parallel
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. T001–T002: Migration + schema doc
2. T003–T010: `instructions` end-to-end + expand/collapse UI
3. **STOP and VALIDATE**: expand a newly planned cell, verify instructions shown
4. Add US2 (T011–T017) as the second increment

### Full Delivery

1. Foundation (T001–T002)
2. US1 data layer (T003–T006) + US1 UI (T007–T010)
3. US2 (T011–T017)
4. Polish (T018–T021)

---

## Notes

- T001 is the most critical task — no DB column means runtime errors on insert
- The hint is ephemeral — never stored; only passed in the AI prompt
- `expandedSlots` and `regenHintSlot` are purely client-side; no server calls needed
- `npm run build` must pass before PR

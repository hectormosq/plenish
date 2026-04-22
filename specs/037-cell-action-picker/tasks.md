# Tasks: Calendar Cell Action Picker

**Input**: Design documents from `/specs/037-cell-action-picker/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Not requested — no test tasks generated.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)

---

## Phase 1: Setup

**Purpose**: Create the new component file so parallel tasks in Phase 2 can proceed.

- [x] T001 Create `src/components/specific/CellActionPicker.tsx` with empty export placeholder

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the shared picker component and add picker state to the grid — both user stories depend on this before they can be wired up.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 Implement `CellActionPicker` component in `src/components/specific/CellActionPicker.tsx`: fixed-position overlay (z-index 40, onClick: onClose) + absolute-positioned card (z-index 50, min-width 180px, max-width 240px), typed `CellActionPickerProps` interface per `contracts/cell-action-picker.md`, two conditional action buttons ("Get Recommendation" shown only when `isFuture=true`, "Log a Meal" always shown), styled with styled-components matching the dark-mode palette from `MemberPickerPopover.tsx`
- [x] T003 Add Escape key `useEffect` to `CellActionPicker` in `src/components/specific/CellActionPicker.tsx` — `document.addEventListener('keydown', ...)` on mount, cleanup on unmount, calls `onClose` when `e.key === 'Escape'`
- [x] T004 Add `ActivePicker` type alias (`{ date: string; mealType: MealType } | null`) and `activePicker` state (`useState<ActivePicker>(null)`) to `MealWeekGrid.tsx` inside the `MealWeekGrid` component

**Checkpoint**: `CellActionPicker` renders with correct props, overlay dismisses on click/Escape, `activePicker` state is in the grid.

---

## Phase 3: User Story 1 — Get an AI Recommendation for a Slot (Priority: P1) 🎯 MVP

**Goal**: Tapping an empty future cell opens the picker instead of immediately triggering the AI call. Selecting "Get Recommendation" resumes the existing `planSingleSlot` flow.

**Independent Test**: Tap an empty future cell → picker appears (no AI spinner yet) → tap "Get Recommendation" → picker closes, loading state appears, planned meal card appears in the cell. Tap outside picker → picker closes, cell is still empty.

### Implementation for User Story 1

- [x] T005 [US1] In `MealWeekGrid.tsx`, replace the `EmptyFutureCell` `onClick` handler (`() => handlePlanSlot(mealType, dayKey)`) with `() => setActivePicker({ date: dayKey, mealType })` — locate in the cell rendering block where `isFuture && !planned && !logged` is true
- [x] T006 [US1] Add `handlePickerRecommend` function in `MealWeekGrid.tsx`: `(mealType: MealType, date: string) => { setActivePicker(null); void handlePlanSlot(mealType, date); }` — this closes the picker then delegates to the unchanged `handlePlanSlot`
- [x] T007 [US1] Mount `<CellActionPicker>` in `MealWeekGrid.tsx` JSX (outside the grid loop, near end of return): render only when `activePicker !== null`, pass `date={activePicker.date}`, `mealType={activePicker.mealType}`, `isFuture={activePicker.date >= todayKey}`, `onGetRecommendation={handlePickerRecommend}`, `onLogMeal` stub (empty for now — filled in US2), `onClose={() => setActivePicker(null)}`

**Checkpoint**: US1 fully functional — future cells require an intentional "Get Recommendation" tap, zero accidental AI calls.

---

## Phase 4: User Story 2 — Log a Meal Directly from the Calendar (Priority: P2)

**Goal**: "Log a Meal" action works from future and past cells. Past empty cells now show the picker (log-only). Future cells gain the "Log a Meal" second option.

**Independent Test (future)**: Tap an empty future cell → picker shows both options → tap "Log a Meal" → navigates to `/dashboard?prefillType=<type>&prefillDate=<date>` with MealLogger pre-filled.  
**Independent Test (past)**: Tap an empty past cell → picker shows only "Log a Meal" → tap it → navigates to `/dashboard` with the past date and meal type pre-filled.

### Implementation for User Story 2

- [x] T008 [US2] Add `handlePickerLogMeal` function in `MealWeekGrid.tsx`: `(mealType: MealType, date: string) => { setActivePicker(null); router.push(\`/dashboard?prefillType=${encodeURIComponent(mealType)}&prefillDate=${encodeURIComponent(date)}\`); }` — no `prefillText` param (user types the meal name themselves)
- [x] T009 [US2] Replace the `onLogMeal` stub passed to `<CellActionPicker>` in `MealWeekGrid.tsx` with `handlePickerLogMeal`
- [x] T010 [P] [US2] Add `EmptyPastCell` styled-component in `MealWeekGrid.tsx` — same base as the plain past ghost `Cell` but with `cursor: pointer` and a subtle hover state (e.g., `background: rgba(255,255,255,0.04)`) to signal interactivity
- [x] T011 [US2] In `MealWeekGrid.tsx`, replace the past empty cell render (ghost "—" `Cell`) with `<EmptyPastCell onClick={() => setActivePicker({ date: dayKey, mealType })}>—</EmptyPastCell>` — applies when `!isFuture && !planned && !logged`

**Checkpoint**: US1 and US2 both fully functional — future picker shows two actions, past picker shows one, "Log a Meal" navigates with correct params for any date.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Responsive layout safety, single-instance guard validation, and build verification.

- [x] T012 [P] Add responsive centering to `CellActionPicker` card in `src/components/specific/CellActionPicker.tsx` — ensure it uses `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);` (or equivalent) and does not overflow on viewports under 400px wide (SC-005); verify by resizing dev tools to 375px
- [x] T013 [P] Add bilingual label maps to `CellActionPicker.tsx`: `const LABELS = { en: { recommend: 'Get Recommendation', log: 'Log a Meal' }, es: { recommend: 'Obtener recomendación', log: 'Registrar comida' } }` driven by a `lang?: 'en' | 'es'` prop (default `'es'`); update `CellActionPickerProps` interface accordingly
- [x] T014 Pass `lang` from `MealWeekGrid.tsx` to `<CellActionPicker>` — derive from existing user locale context or default to `'es'` if not yet available
- [x] T015 Run `npm run build` from repo root and fix any TypeScript strict-mode errors in `CellActionPicker.tsx` and `MealWeekGrid.tsx` before marking complete

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on T001 — BLOCKS US1 and US2
- **US1 (Phase 3)**: Depends on T002–T004 (full Foundational)
- **US2 (Phase 4)**: Depends on T002–T004 (full Foundational) — can start in parallel with US1 once Foundational completes; T009 depends on T008
- **Polish (Phase 5)**: T012, T013 can run in parallel after T002; T014 depends on T013; T015 depends on all prior tasks

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational only — no dependency on US2
- **US2 (P2)**: Depends on Foundational only — T009 (wire handler) depends on T008 (define handler); past cell work (T010–T011) is independent of future cell work (T008–T009)

### Parallel Opportunities

- T010 (`EmptyPastCell` styled component) can be written in parallel with T008–T009 — different concerns in the same file but no data dependency
- T012 (responsive layout) and T013 (bilingual labels) can both be worked on in parallel during Polish — both touch only `CellActionPicker.tsx` but different sections

---

## Parallel Example: User Story 2

```
# Once Foundational (T002-T004) is complete:

Stream A — future cell "Log a Meal":
  T008: Add handlePickerLogMeal to MealWeekGrid.tsx
  T009: Wire onLogMeal into <CellActionPicker> mount

Stream B — past cell interactivity:
  T010: Add EmptyPastCell styled component to MealWeekGrid.tsx
  T011: Replace ghost past cell with EmptyPastCell + onClick

# Both streams merge at checkpoint — both must complete for US2 test to pass
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002–T004) — CRITICAL
3. Complete Phase 3: User Story 1 (T005–T007)
4. **STOP and VALIDATE**: Tap future cells → picker appears → "Get Recommendation" works → outside tap dismisses
5. Demo / deploy US1 independently

### Incremental Delivery

1. Setup + Foundational → picker component and state exist
2. US1 → future cell recommendation gated behind picker (MVP)
3. US2 → log a meal from future + past cells
4. Polish → bilingual labels, mobile safety, build gate

---

## Notes

- [P] tasks = different files or independent sections, no blocking dependencies
- `activePicker` single-state pattern in `MealWeekGrid.tsx` enforces FR-008 (one picker at a time) automatically — no extra guard needed
- `handlePlanSlot` is unchanged — `handlePickerRecommend` is a thin wrapper that closes the picker first
- Past date `prefillDate` is accepted by `MealLogger` (verified: `initialDate` prop + `eaten_at` field supports any date)
- No server actions, no migrations, no new routes — all changes are in two files
- Run quickstart.md acceptance checklist manually after T015 passes

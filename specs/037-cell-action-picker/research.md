# Research: Calendar Cell Action Picker

## Decision 1 — Picker Component Architecture

**Decision**: Build a new `CellActionPicker` component modelled on the existing `MemberPickerPopover` pattern (`src/components/specific/MemberPickerPopover.tsx`).

**Rationale**: `MemberPickerPopover` already establishes the canonical in-codebase pattern: fixed-position overlay (z-index 40) + absolute-positioned card (z-index 50) + Escape key dismiss. Reusing this pattern keeps styled-components usage consistent (Principle V) and avoids introducing a second popover approach.

**Alternatives considered**: 
- Reusing `MemberPickerPopover` directly — rejected because it is domain-specific (co-eater selection) and its interface doesn't match action-picker semantics.
- Radix UI / Headless UI popover primitives — rejected; would introduce a new dependency without justification (Principle V).

---

## Decision 2 — State Location for Active Picker

**Decision**: Lift picker state into `MealWeekGrid` as `activePicker: { date: string; mealType: MealType } | null`. A single state variable naturally enforces FR-008 (only one picker open at a time) — opening a new one replaces the previous value.

**Rationale**: `MealWeekGrid` already owns `planningSlots` and all cell interaction handlers. Co-locating picker state here avoids prop-drilling or a new context.

**Alternatives considered**: 
- Context / Zustand global state — rejected; this is purely ephemeral UI state scoped to the grid.

---

## Decision 3 — Past Cell Click Handling

**Decision**: Past cells currently render a plain `Cell` with "—" ghost text and no `onClick`. We will render past empty cells as a `EmptyPastCell` styled-component (cursor: pointer, hover indicator) with an `onClick` that sets `activePicker`. The picker for past cells renders only the "Log a Meal" option.

**Rationale**: Spec FR-007 says past slots must show the picker with only "Log a Meal". The isFuture check (`dayKey >= todayKey`) in `MealWeekGrid` already cleanly separates past from future rendering.

**Alternatives considered**: 
- Reuse `EmptyFutureCell` for both — rejected; the visual language differs (past ≠ actionable for planning), so a distinct styled component is clearer.

---

## Decision 4 — "Log a Meal" Navigation for Past Dates

**Decision**: Reuse the existing `/dashboard?prefillType=...&prefillDate=...` navigation pattern. For "Log a Meal" from the picker, navigate with `prefillType` and `prefillDate` but **without** `prefillText` (the user types the meal themselves).

**Rationale**: `MealLogger` already accepts `initialDate?: string` and `initialMealType?: MealType` as props wired from `searchParams` in `src/app/dashboard/page.tsx`. The `MealLogger` component sets `eaten_at` from `initialDate`, which supports any valid date — past or future. No server action changes needed.

**Alternatives considered**: 
- Open a modal inline on the calendar page — rejected; would require duplicating MealLogger or extracting it, out of scope for this feature.
- Pass date as a query param named differently — rejected; the existing `prefillDate` param is already defined and consumed.

---

## Decision 5 — i18n / Bilingual Support

**Decision**: Follow existing codebase pattern (hardcoded string constants in the component) for now. New picker labels will be defined as typed string maps (`Record<'en'|'es', string>`) driven by a `lang` prop or local user locale detection — a lightweight bridge until the project adds a full i18n library.

**Rationale**: The constitution requires bilingual support (en + es), but the project has no i18n library configured yet — `MealWeekGrid`, `MealLogger`, and other components use hardcoded strings. Introducing `next-intl` in a single-component PR is premature and violates Principle V (no second way to do anything without justification). The lightweight approach keeps us compliant with the spirit of the constitution without scope creep.

**Constitution conflict flagged**: `CONFLICT` — constitution says "UI copy must use a translated key and translation files" but existing code uses hardcoded strings. Resolution deferred to a dedicated i18n setup sprint; this feature follows the existing pattern.

**Alternatives considered**: 
- Add `next-intl` in this PR — rejected; full i18n wiring is a cross-cutting concern for a separate ticket.

---

## Decision 6 — Picker Positioning on Narrow Mobile Cells

**Decision**: Position the picker centered relative to the trigger cell using `position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%)` on a containing element, with a `min-width: 180px` floor and `max-width: 240px` cap. On viewports < 400px, the overlay is full-width so the card always fits.

**Rationale**: Calendar cells on mobile are ~60–80px wide — not enough to anchor a left-aligned popover. Centering avoids overflow without needing `getBoundingClientRect` JS calculations. SC-005 requires correct rendering under 400px.

**Alternatives considered**: 
- Fixed position centered on screen — simpler but feels disconnected from the tapped cell.
- JS-based `useRef` + `getBoundingClientRect` — more precise but overkill for two-option picker.

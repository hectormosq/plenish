# Feature Specification: Calendar Cell Action Picker

**Feature Branch**: `037-cell-action-picker`  
**Created**: 2026-04-20  
**Status**: Draft  
**Input**: User description: "https://github.com/hectormosq/plenish/issues/33"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Get an AI Recommendation for a Slot (Priority: P1)

A user sees an empty future meal slot on their calendar and wants the app to suggest a meal for that slot. They tap the cell, a small action picker appears, and they choose "Get Recommendation." The app generates a planned meal suggestion for that date and meal type.

**Why this priority**: This is the existing core planning flow. Making it intent-driven prevents accidental AI calls and sets the foundation for the second action.

**Independent Test**: Tap an empty future cell → picker appears → tap "Get Recommendation" → a planned meal card appears in the cell. The slot behaves exactly as before the picker was introduced, only now it requires one intentional extra tap.

**Acceptance Scenarios**:

1. **Given** a future empty meal slot, **When** the user taps it, **Then** a small action picker appears without triggering any AI call yet.
2. **Given** the picker is open, **When** the user taps "Get Recommendation", **Then** the picker closes, the slot shows a loading state, and a planned meal suggestion is returned.
3. **Given** the picker is open, **When** the user taps outside it or presses Escape, **Then** the picker closes and no action is taken.

---

### User Story 2 — Log a Meal Directly from the Calendar (Priority: P2)

A user taps an empty meal slot — future or past — and wants to log something they ate or plan to eat. They choose "Log a Meal" from the picker and the meal logger opens pre-filled with the correct date and meal type.

**Why this priority**: Users often know what they're eating (or have already eaten) and should be able to log it directly from the calendar without going through the AI recommendation flow. This applies to both future planning and retroactive logging of past meals.

**Independent Test (future slot)**: Tap an empty future cell → picker appears with both options → tap "Log a Meal" → the meal logger opens with date and meal type already populated. The user can type the meal name and submit.

**Independent Test (past slot)**: Tap an empty past cell → picker appears with only "Log a Meal" (no "Get Recommendation") → tap "Log a Meal" → the meal logger opens with the past date and meal type already populated.

**Acceptance Scenarios**:

1. **Given** the picker is open on a future slot, **When** the user taps "Log a Meal", **Then** the picker closes and the meal logger opens pre-filled with the slot's date and meal type.
2. **Given** an empty past meal slot, **When** the user taps it, **Then** a picker appears showing only the "Log a Meal" option (no "Get Recommendation").
3. **Given** the picker is open on a past slot, **When** the user taps "Log a Meal", **Then** the picker closes and the meal logger opens pre-filled with that past date and meal type.
4. **Given** the meal logger is pre-filled, **When** the user submits a meal, **Then** the logged meal appears in the correct calendar cell and the slot is no longer empty.
5. **Given** the meal logger is opened from the picker, **When** the user cancels or navigates back, **Then** the calendar cell returns to its empty state with no side effects.

---

### Edge Cases

- What happens if the user taps an empty cell very rapidly multiple times? The picker must not open multiple instances or fire duplicate AI calls.
- How does the picker render on small mobile screens where cells are narrow? It must not overflow or be unreadable on viewports under 400px wide.
- What if the AI call fails after "Get Recommendation" is selected? The slot must show an error state and let the user retry without navigating away.
- What happens if the slot becomes occupied (by another session or tab) while the picker is open? On submission, the new meal should either merge or replace gracefully.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When a user taps an empty future meal slot, the system MUST display an action picker instead of immediately triggering a meal recommendation.
- **FR-002**: The action picker MUST present "Get Recommendation" and "Log a Meal" for future slots, and only "Log a Meal" for past slots.
- **FR-003**: Selecting "Get Recommendation" MUST trigger the AI meal suggestion flow for that slot's date and meal type, identical to the current direct-tap behavior.
- **FR-004**: Selecting "Log a Meal" MUST open the meal logger pre-filled with the slot's date and meal type.
- **FR-005**: Tapping outside the picker or pressing Escape MUST close the picker without triggering any action or side effect.
- **FR-006**: The picker MUST be dismissible on both desktop (click outside / Escape key) and mobile (tap outside).
- **FR-007**: The picker MUST appear for both future and past empty slots. For past slots it shows only "Log a Meal"; for future slots it shows both options. Current-day slots are treated as future (both options available).
- **FR-008**: Only one picker instance MUST be visible at a time; opening a new one MUST dismiss any previously open picker.

### Key Entities

- **Meal Slot**: A combination of calendar date and meal type (breakfast, snack, lunch, dinner). A slot is "empty" when it has neither a logged meal nor a planned meal.
- **Action Picker**: A transient overlay that appears on empty slot interaction (past or future). For future slots it presents two choices ("Get Recommendation" and "Log a Meal"); for past slots it presents only "Log a Meal". Fully dismisses after a choice is made or the user taps away.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can open the picker and select an option within 3 seconds of tapping an empty slot.
- **SC-002**: Zero accidental AI recommendation calls occur — the flow is never triggered without an explicit "Get Recommendation" selection.
- **SC-003**: Users who select "Log a Meal" reach the pre-filled meal logger in a single tap with no additional navigation steps required.
- **SC-004**: The picker dismisses completely (no residual UI state) on outside tap or Escape, 100% of the time.
- **SC-005**: The picker renders correctly on all supported viewports, including mobile screens under 400px wide, with no overflow or clipping.

## Assumptions

- The meal logger pre-fill flow via URL parameters already exists and functions correctly — this feature only wires the picker to trigger it with the right parameters.
- Past empty cells show the picker with only "Log a Meal" to support retroactive meal logging; current-day cells are treated as future (both options).
- The picker is a lightweight inline popover, not a full-screen modal — keeping the interaction minimal and non-disruptive.
- No new persistent data is introduced; the picker is entirely transient UI state.
- The two-option picker is sufficient for v1; additional options (e.g., "Copy from last week") are out of scope.

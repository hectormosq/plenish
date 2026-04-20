# Feature Specification: Structured Meal Recommendations with Ingredients and Instructions

**Feature Branch**: `036-structured-meal-recommendations`  
**Created**: 2026-04-17  
**Status**: Draft  
**Input**: User description: "https://github.com/hectormosq/plenish/issues/34"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Ingredients and Instructions for a Planned Meal (Priority: P1)

A user has a planned meal on the calendar. Today they can only see the meal name. With this feature, they can tap an expand toggle on the planned meal cell to reveal the full ingredients list and cooking instructions — without leaving the calendar view.

**Why this priority**: This is the core value add of the feature. Structured data must exist and be displayed before the regenerate hint flow makes sense.

**Independent Test**: Plan a meal slot, then expand the planned meal cell and verify ingredients and instructions are shown. Collapse it and verify only the name shows.

**Acceptance Scenarios**:

1. **Given** a planned meal cell on the calendar, **When** the user taps the expand toggle, **Then** the cell expands to show the ingredients list and cooking instructions
2. **Given** an expanded planned meal cell, **When** the user taps the toggle again, **Then** the cell collapses back to showing only the meal name
3. **Given** a planned meal that was created before this feature shipped, **When** the user expands it, **Then** the cell gracefully handles missing data (e.g. shows "No details available")

---

### User Story 2 - Hint at Preferred Ingredients When Regenerating (Priority: P2)

When the user taps the regenerate button (↻) on a planned meal, an optional ingredient hint field appears. The user can type preferred ingredients (e.g. "chicken, rice") and the AI takes them into account when generating the new suggestion.

**Why this priority**: This gives the user meaningful control over recommendations without requiring a full conversation. It is a direct upgrade to the regenerate flow already in place.

**Independent Test**: Tap regenerate on a planned meal cell, enter an ingredient hint, confirm, and verify the regenerated meal reflects the hint.

**Acceptance Scenarios**:

1. **Given** a planned meal cell, **When** the user taps regenerate, **Then** an optional hint input appears before the AI is called
2. **Given** the hint input is shown, **When** the user leaves it empty and confirms, **Then** regeneration proceeds as before with no hint
3. **Given** the hint input is shown, **When** the user types "pollo y verduras" and confirms, **Then** the AI generates a meal that incorporates the hinted ingredients
4. **Given** a regenerated meal, **When** the user expands the cell, **Then** the new ingredients and instructions are shown

---

### Edge Cases

- If the AI fails to return structured data (name, ingredients, instructions), the cell must still display the meal name and show a graceful fallback for missing fields
- Ingredient hints are advisory — the AI may not be able to honour them exactly (e.g. dietary restrictions override the hint); no error is shown in that case
- Expanding/collapsing must not trigger a network request — the data is already stored
- If a planned meal has no instructions (legacy data), the expanded view shows only the ingredients section without an empty instructions block

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The AI MUST return structured meal data for all plan paths: a meal name, a list of ingredients, and cooking instructions
- **FR-002**: The structured data MUST be persisted so it is available without a new AI call when the user expands the cell
- **FR-003**: Each planned meal cell MUST have an expand/collapse toggle visible to the user
- **FR-004**: The expanded view MUST display the ingredients list and cooking instructions
- **FR-005**: The collapsed view MUST show only the meal name (current behaviour preserved)
- **FR-006**: The regenerate action MUST present an optional ingredient hint input before calling the AI
- **FR-007**: When a hint is provided, it MUST be passed to the AI as a soft constraint for the new recommendation
- **FR-008**: When no hint is provided, regeneration MUST behave identically to the current flow
- **FR-009**: Missing or legacy data MUST be handled gracefully — no blank or broken cells

### Key Entities

- **Planned Meal**: An AI-suggested meal assigned to a calendar slot; gains `ingredients` (list of items) and `instructions` (free text) fields
- **Ingredient Hint**: A free-text string entered by the user at regenerate time; ephemeral — not persisted after the regeneration completes

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can view ingredients and instructions for any planned meal in under 2 taps from the calendar — verified across desktop and mobile viewports
- **SC-002**: 100% of newly generated planned meals include ingredients and instructions — no structured-data gaps on the happy path
- **SC-003**: A regenerated meal with a provided ingredient hint incorporates at least one of the hinted ingredients in its name or ingredient list — verified across 10 test regenerations
- **SC-004**: Expanding a planned meal cell introduces no visible loading delay — data is shown immediately from stored values
- **SC-005**: Legacy planned meals (no structured data) display gracefully without errors in 100% of cases

## Assumptions

- The schema change (adding `ingredients` and `instructions` to planned meals) requires a database migration
- `ingredients` is stored as a list of strings; `instructions` is stored as free text
- The ingredient hint is not saved to the database — it is used only for the duration of the regeneration request
- The expand/collapse state is local to the UI session — it does not need to persist across page reloads
- Structured data is generated for all plan paths: single slot plan, week plan, and regenerate
- The AI is capable of reliably producing structured output in the required format; a fallback to name-only is acceptable when it fails

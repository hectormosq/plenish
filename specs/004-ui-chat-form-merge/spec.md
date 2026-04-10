# Feature Specification: Merge Chat + Log Form UI

**Feature Branch**: `004-ui-chat-form-merge`  
**Created**: 2026-04-10  
**Status**: Ready for Planning  
**Priority**: P1 (Foundation for all subsequent UI phases)

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Chat-Centric Meal Logging (Priority: P1)

A user wants to log a meal using natural conversation, with optional structured inputs to make requests more concise. Rather than juggling separate chat and form, they interact with a single unified interface where they can type freely or use meal type chips to provide context.

**Why this priority**: This is the foundation for the entire UX redesign. All subsequent phases depend on this unified interface.

**Independent Test**: User can log a meal via the merged interface, see it appear in the activity feed, and the feature works identically to the current separate form + chat combination.

**Acceptance Scenarios**:

1. **Given** a user on the dashboard, **When** they see the chat area, **Then** the chat area now includes meal type chips (`[Breakfast] [Lunch] [Snack] [Dinner]`) above the input field.
2. **Given** the user clicks a meal type chip, **When** they type a meal description, **Then** the chip pre-fills context (e.g., the meal type is pre-selected for logging).
3. **Given** a user has household members, **When** they look at the input area, **Then** they see a 3-state share button next to the send button showing current share status.
4. **Given** the user types a message and sends it, **Then** either the AI responds (if it's a chat question) or the meal is logged (if it's a meal entry with meal type context).
5. **Given** the user successfully logs a meal, **Then** they see a brief confirmation in the chat ("✓ Logged your lunch. Looks delicious!") and the meal appears in the recent activity feed.
6. **Given** the current form shows a dropdown for meal type, **When** Phase 1 is complete, **Then** the dropdown is replaced by chips, reducing clicks and making the UX more discoverable.

---

### User Story 2 — Share Button Clarity (Priority: P1)

A user wants to understand at a glance whether a meal will be shared with their household or just logged for themselves. The new 3-state share button makes this obvious without hidden checkboxes.

**Why this priority**: Current toggle + hidden checkboxes is confusing. Clarity improves confidence.

**Acceptance Scenarios**:

1. **Given** a user has no household, **When** they look at the share button, **Then** the share button is hidden or disabled (no co-eaters available).
2. **Given** a user has household members, **When** they look at the share button in its default state, **Then** it shows "👤 Just me" (indicating no sharing).
3. **Given** the user clicks the share button, **When** it transitions to "👥 Shared with household", **Then** all household members are pre-selected.
4. **Given** the user clicks the share button again, **When** a member picker appears, **Then** the user can select/deselect specific members and confirm.
5. **Given** the user confirms partial member selection, **When** the button is closed, **Then** it displays "👥 Ana, Pedro" (or count: "👥 2/3") showing exactly who the meal will be shared with.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The UI MUST consolidate `AIChatBox.tsx` and `LogMealForm.tsx` into a single `MealLogger.tsx` component.
- **FR-002**: The component MUST display a row of meal type chips (`Breakfast`, `Lunch`, `Snack`, `Dinner`) above the text input, replacing the current `<select>` dropdown.
- **FR-003**: Clicking a chip MUST pre-select that meal type in the component's internal state (not immediately submit).
- **FR-004**: The component MUST retain full chat functionality from `AIChatBox` — AI responses appear in the message history.
- **FR-005**: The component MUST retain full meal logging functionality from `LogMealForm` — meals are logged to the database via the `logMeal` server action.
- **FR-006**: The 3-state share button MUST be visible next to the send button (not in a hidden form section).
- **FR-007**: The share button text MUST reflect the current share state: "👤 Just me" (default) | "👥 Shared with household" (all) | "👥 Name1, Name2" (partial).
- **FR-008**: The component MUST support both chat messages and meal logging in the same input — context (meal type chip) determines which action occurs.
- **FR-009**: After a meal is logged, a brief confirmation message MUST appear in the chat history (e.g., "✓ Logged your lunch").
- **FR-010**: The component MUST be positioned in the left column of the dashboard (same as current `AIChatBox`), and the `logMealFormSlot` becomes `mealLoggerSlot`.

### UI/UX Requirements

- **UX-001**: Meal type chips MUST be styled as toggleable buttons (not dropdowns), using existing chip styling from `MemberCheckRow` or new `Chip` styled component.
- **UX-002**: The share button MUST use the same 3-state logic as specified in Phase 3 spec (but can be implemented in Phase 1 without the member picker).
- **UX-003**: The component height MUST NOT exceed the current chat box height (600px fixed) without user scrolling.
- **UX-004**: The input area MUST feel conversational (single unified text field, not multiple form sections).
- **UX-005**: Meal type chips MUST be optional context hints, not required form fields (user can still log a meal via chat without selecting a chip).

### Technical Requirements

- **TR-001**: Use styled-components for all new styling (no Tailwind).
- **TR-002**: Component MUST be a client component (`'use client'`).
- **TR-003**: Reuse existing `useChat()` hook from Vercel AI SDK for conversation state.
- **TR-004**: Reuse existing `useTransition` + `router.refresh()` pattern for meal logging.
- **TR-005**: Component MUST accept `householdMembers?: HouseholdMemberSimple[]` prop (from `LogMealFormWrapper`).
- **TR-006**: Component MUST NOT break existing server actions (`logMeal`, household fetchers, etc.).

---

## Key Entities

- **MealLogger** (new): Client component combining chat + meal form
- **MealType**: Enum (`breakfast` | `lunch` | `dinner` | `snack`)
- **ShareState**: Type representing 3-state share button (`'just-me'` | `'all'` | `'partial'`)
- **HouseholdMemberSimple**: Existing type from `actions/households.ts`

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: User can log a meal using the merged interface in under 15 seconds (same or faster than current separate form).
- **SC-002**: Chat functionality (AI responses, message history) is unchanged from current `AIChatBox`.
- **SC-003**: Meal logging functionality (database persistence, household sharing) is unchanged from current `LogMealForm`.
- **SC-004**: The share button accurately reflects the intended sharing state before the meal is logged.
- **SC-005**: No regression in existing features (household fetch, meal CRUD, AI chat).
- **SC-006**: Mobile layout remains readable (stacked single-column, no layout breaks).

---

## Assumptions

- Meal type chips are visual hints, not form validation (user can log a meal via chat without selecting a chip).
- The 3-state share button logic can be deferred to Phase 3, but visual state (Just me / Shared / Partial) is implemented in Phase 1.
- `LogMealFormWrapper` continues to fetch household members and passes them to `MealLogger`.
- Chat history and meal logging state can coexist in the same component without interference.
- The merged component fits within the current 600px height (may require scrolling for long chat histories).

---

## Non-Goals

- Member picker popover (deferred to Phase 3)
- Weekly calendar integration (deferred to Phase 2)
- Mobile bottom sheet (deferred to Phase 7)
- Settings page (deferred to Phase 5)

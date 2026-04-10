# Feature Specification: Weekly Meal Calendar Grid

**Feature Branch**: `005-ui-weekly-calendar`  
**Created**: 2026-04-10  
**Status**: Ready for Planning  
**Priority**: P1 (Replaces Recent Activity list with visual overview)  
**Depends On**: Phase 1 (MealLogger) ✅

## User Scenarios & Testing

### User Story 1 — Week Overview (Priority: P1)

A user wants to see their meal history for the current week at a glance. Instead of scrolling through a chronological list, they see a grid with days (Mon-Sun) and meal types (Breakfast, Lunch, Dinner, Snacks), showing which meals have been logged and which are missing.

**Why this priority**: Users can instantly see patterns ("I skipped breakfast Wed", "I haven't logged dinner today").

**Acceptance Scenarios**:

1. **Given** a user on the dashboard, **When** they look at the right column, **Then** they see a weekly calendar grid instead of the flat "Recent Activity" list.
2. **Given** the calendar displays a week (Mon-Sun), **When** a meal is logged for a day, **Then** it appears as a colored block in the correct day/meal type cell.
3. **Given** a user logged lunch on Monday, **When** they view the grid, **Then** the "Lunch" cell for Monday is filled with green and shows the meal summary (e.g., "Tacos al pastor").
4. **Given** breakfast wasn't logged on Wednesday, **When** they view the grid, **Then** the "Breakfast" cell for Wednesday is empty/ghost (light border, "—" text).
5. **Given** today is Friday, **When** they view the grid, **Then** Friday's column is highlighted (thicker border or tint) to show "today".
6. **Given** a user hovers over a logged meal cell, **Then** a tooltip shows the full meal text + timestamp + delete button.
7. **Given** the user clicks delete on a meal cell, **Then** the cell becomes empty and the database is updated.

---

### User Story 2 — Shared Meals Indicator (Priority: P1)

A user wants to distinguish their personal meals from meals shared by household members. The calendar shows a small `👥` badge on meals that are shared, so they know at a glance which meals are household contributions.

**Why this priority**: Important for household context (knowing who contributed which meals).

**Acceptance Scenarios**:

1. **Given** a household meal is logged, **When** it appears in the calendar, **Then** it shows a small `👥` badge to indicate it's shared.
2. **Given** a user hovers over a shared meal, **Then** the tooltip shows co-eater count/names (e.g., "Shared with Ana, Pedro").
3. **Given** a user right-clicks or taps a shared meal, **Then** they can dismiss it (hide from their view without deleting it).

---

## Requirements

### Functional Requirements

- **FR-001**: The calendar MUST display a 7-column grid (Mon-Sun) × 5-row grid (Breakfast, Snack, Lunch, Snack, Dinner).
- **FR-002**: Calendar MUST fetch meals from `getRecentMeals()` and group by date + meal type.
- **FR-003**: Logged meal cells MUST show meal summary text (truncated if needed).
- **FR-004**: Missing meal cells MUST display as ghost (light border, "—" placeholder).
- **FR-005**: Today's column MUST be highlighted (thicker border or background tint).
- **FR-006**: Date headers MUST show: "Today" (current day), day names "Mon"/"Tue" (same week), or full date "Mar 28" (older).
- **FR-007**: Hovering a cell MUST show tooltip with full meal text + time + delete button.
- **FR-008**: Clicking delete MUST call `deleteMeal()` and refresh the calendar.
- **FR-009**: Shared meals MUST display `👥` badge.
- **FR-010**: Hovering shared meal MUST show co-eater names/count in tooltip.
- **FR-011**: Right-click/tap shared meal MUST offer "Dismiss" option (call `dismissSharedMeal()`).

### UI/UX Requirements

- **UX-001**: Calendar cells colored by meal type (breakfast yellow, lunch green, dinner blue, snack purple).
- **UX-002**: Colored blocks should be easily scannable (good contrast, consistent spacing).
- **UX-003**: Grid fits in right column without excessive scrolling (max 600px height with scroll if needed).
- **UX-004**: Mobile: Grid scrolls horizontally to show multiple days or shows single day with navigation.
- **UX-005**: Empty cells should be visually distinct from logged cells (ghost styling).

### Technical Requirements

- **TR-001**: Async server component `MealCalendar.tsx` fetches `getRecentMeals()` + `getHouseholdMeals()`.
- **TR-002**: Client component `MealWeekGrid.tsx` renders grid interactively.
- **TR-003**: Use styled-components for grid layout (CSS Grid or Flexbox).
- **TR-004**: Integrate with existing `deleteMeal()` and `dismissSharedMeal()` actions.
- **TR-005**: No new database tables required.

---

## Success Criteria

- **SC-001**: User can see entire week's meal pattern at a glance.
- **SC-002**: Meals color-coded by type (breakfast ≠ lunch ≠ dinner).
- **SC-003**: Missing meals visually distinct from logged meals.
- **SC-004**: Shared meals marked with `👥` and co-eater info on hover.
- **SC-005**: Delete and dismiss actions work without page reload.
- **SC-006**: Mobile navigation between weeks works smoothly.
- **SC-007**: Zero regressions (existing meal logs still display, delete still works).

---

## Non-Goals

- Edit meal details via calendar (defer to future)
- Multi-week navigation (show just current week in Phase 2)
- Meal recommendations in calendar (defer to Phase 6)

---

# Implementation Plan: Weekly Meal Calendar

**Branch**: `005-ui-weekly-calendar` | **Depends On**: Phase 1  
**Scope**: Replace "Recent Activity" list with visual grid showing breakfast/lunch/dinner per day.

## Architecture

### Components

**MealCalendar.tsx** (async server component):
```typescript
export async function MealCalendar() {
  const [meals, sharedMeals] = await Promise.all([
    getRecentMeals(),
    getHouseholdMeals(50),
  ]);
  const merged = mergeMealsByDate(meals, sharedMeals);
  return <MealWeekGrid meals={merged} />;
}
```

**MealWeekGrid.tsx** (client component, interactive):
```typescript
export function MealWeekGrid({ meals }: { meals: MergedMeal[] }) {
  // Return 7-column × 5-row grid
  // Cells colored by meal type, shared badge, delete/dismiss buttons
}
```

## File Changes

- **Create**: `/src/components/specific/MealCalendar.tsx`
- **Create**: `/src/components/ui/MealWeekGrid.tsx`
- **Modify**: `/src/app/dashboard/DashboardLayout.tsx` (add `calendarSlot`)
- **Modify**: `/src/app/dashboard/page.tsx` (add calendar to layout)
- **Delete/Deprecate**: `RecentMeals.tsx`, `RecentMealsList.tsx`, `SharedMealLogList.tsx`

## Testing

- Calendar renders correctly (mon-sun, 5 meal types)
- Meals appear in correct cells with correct colors
- Shared meals show `👥` badge
- Delete and dismiss work without reload
- Mobile scroll works
- No regressions

---

# Research: Codebase Patterns

*See `research.md` for*:
- Meal data structure (MealLog, meal_logs table)
- Color scheme (breakfast yellow, lunch green, dinner blue, snack purple)
- Grid layout patterns from existing UI
- Delete/dismiss action patterns
- Shared meal indicator patterns (already used in SharedMealLogList)

---

# Tasks Checklist

1. [ ] Create `MealCalendar.tsx` async server component
2. [ ] Create `MealWeekGrid.tsx` client component with grid layout
3. [ ] Implement meal grouping by date + meal type
4. [ ] Add color coding for meal types
5. [ ] Add shared meal badge logic
6. [ ] Add delete button to meal cells
7. [ ] Add dismiss button to shared meal cells
8. [ ] Implement tooltip on hover
9. [ ] Add today's column highlight
10. [ ] Update dashboard layout + page
11. [ ] Test desktop grid layout
12. [ ] Test mobile scrolling
13. [ ] Verify delete/dismiss work
14. [ ] Test shared meals display
15. [ ] Check for regressions
16. [ ] Commit with message

**Estimated Time**: 4-6 hours

---

# Requirements Checklist

- [ ] FR-001 to FR-011: All functional requirements met
- [ ] UX-001 to UX-005: All UX requirements met
- [ ] TR-001 to TR-005: All technical requirements met
- [ ] SC-001 to SC-007: All success criteria met
- [ ] No regressions in existing features
- [ ] TypeScript build clean
- [ ] Mobile and desktop both work

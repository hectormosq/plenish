# Requirements: Phase 2

**Functional**:
- [ ] FR-001: 7-col × 5-row grid displays (Mon-Sun, Breakfast-Dinner)
- [ ] FR-002: Meals grouped by date + type
- [ ] FR-003: Logged cells show meal summary
- [ ] FR-004: Missing cells display ghost (light, "—")
- [ ] FR-005: Today highlighted
- [ ] FR-006: Date headers correct ("Today", "Mon", or "Mar 28")
- [ ] FR-007: Hover shows tooltip + delete button
- [ ] FR-008: Delete works via deleteMeal() for own meals, dismissSharedMeal() for co-eater meals
- [ ] FR-009: Shared meals show 👥 badge
- [ ] FR-010: Shared hover shows co-eater info
- [ ] FR-011: Dismiss hides shared meal

**UX**:
- [ ] UX-001: Cells color-coded by meal type
- [ ] UX-002: Blocks scannable + good contrast
- [ ] UX-003: Fits in right column (may scroll)
- [ ] UX-004: Mobile scrolls horizontally or shows single day
- [ ] UX-005: Ghost cells visually distinct

**Technical**:
- [ ] TR-001: MealCalendar async server component
- [ ] TR-002: MealWeekGrid client interactive
- [ ] TR-003: styled-components for grid
- [ ] TR-004: Uses deleteMeal + dismissSharedMeal
- [ ] TR-005: No new DB tables

**Success**:
- [ ] Week pattern visible at glance
- [ ] Colors match meal types
- [ ] Missing meals distinct
- [ ] Shared marked with 👥
- [ ] Delete/dismiss work
- [ ] Mobile navigation smooth
- [ ] No regressions

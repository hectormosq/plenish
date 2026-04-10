# Phase 2 Plan: Weekly Meal Calendar

**Branch**: `005-ui-weekly-calendar` | **Date**: 2026-04-10  
**Scope**: Replace flat list with visual grid showing breakfast/lunch/dinner per day + shared meal badges.

## Summary

Create `MealCalendar.tsx` (server fetcher) + `MealWeekGrid.tsx` (interactive grid). Merge personal + household meals by date + meal type. Display as 7-column × 5-row grid with color coding, shared badges, delete/dismiss actions.

## Files

**Create**:
- `/src/components/specific/MealCalendar.tsx`
- `/src/components/ui/MealWeekGrid.tsx`

**Modify**:
- `/src/app/dashboard/DashboardLayout.tsx` (add `calendarSlot`)
- `/src/app/dashboard/page.tsx` (add calendar to layout)

**Deprecate**:
- `RecentMeals.tsx`, `RecentMealsList.tsx`, `SharedMealLogList.tsx`

## Key Implementation Details

- `MealWeekGrid` uses CSS Grid: `grid-template-columns: repeat(7, 1fr); grid-template-rows: repeat(5, auto)`
- Meal type colors: breakfast #fbbf24, lunch #34d399, dinner #818cf8, snack #a78bfa
- Shared badge: small `👥` icon overlay on meal cell
- Hover tooltip: full text + time + delete button
- Today highlight: thicker border or background overlay
- Mobile: horizontal scroll or single-day view with prev/next buttons

## Testing

- Grid displays all 7 days × 5 meal types ✓
- Meals appear in correct cells ✓
- Colors match meal types ✓
- Shared meals show badge ✓
- Delete removes meal ✓
- Dismiss hides shared meal ✓
- Mobile scrolls/navigates ✓
- No regressions ✓

## Tasks: ~16 items, 4-6 hours

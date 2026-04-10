# Codebase Patterns

- Meal types: breakfast/lunch/snack/dinner
- Colors: breakfast #fbbf24, lunch #34d399, dinner #818cf8, snack #a78bfa
- Grid: CSS Grid 7×5 for days × meal types
- Date formatting: "Today", "Mon", "Tue", or "Mar 28" for older
- Shared meals: `is_shared` flag, `meal_participants` join table
- Delete action: `deleteMeal(id)` from actions/meals
- Dismiss action: `dismissSharedMeal(id)` from actions/meals
- Co-eater display: `meal_participants` with `dismissed` flag

## Reusable Code

See Phase 1 research for base patterns. MealWeekGrid adds:
- CSS Grid layout
- Meal grouping algorithm (by date + type)
- Tooltip component (styled-components)
- Hover interactions
- Shared badge rendering

## Reference

- Color scheme already defined across components
- Card wrapper pattern from existing UI
- Meal deletion pattern from RecentMealsList
- Shared meal display from SharedMealLogList

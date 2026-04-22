# Data Model: Calendar Cell Action Picker

## Schema Changes

**None.** This feature is entirely transient UI state. No new tables, columns, or migrations are required.

The picker state lives in React component state and is never persisted to Supabase.

---

## UI State Entities

### `ActivePicker`

Transient state held in `MealWeekGrid` — represents which cell's picker is currently open.

| Field      | Type     | Description                                      |
|------------|----------|--------------------------------------------------|
| `date`     | `string` | ISO date key `"YYYY-MM-DD"` of the slot          |
| `mealType` | `MealType` | `'breakfast' \| 'snack' \| 'lunch' \| 'dinner'` |

```typescript
type ActivePicker = { date: string; mealType: MealType } | null;
```

**State transitions**:
- `null` → `{ date, mealType }` when user taps an empty cell (past or future)
- `{ date, mealType }` → `null` when user taps overlay, presses Escape, or selects an action
- `{ date1, ... }` → `{ date2, ... }` when user taps a different empty cell (replaces, FR-008)

---

### `CellSlotKind`

Derived value — not stored, computed from `dayKey` vs `todayKey` at render time.

| Value    | Condition              | Picker Actions Available         |
|----------|------------------------|----------------------------------|
| `future` | `dayKey >= todayKey`   | "Get Recommendation", "Log a Meal" |
| `past`   | `dayKey < todayKey`    | "Log a Meal" only                |

---

## Existing Entities Used (no changes)

| Entity          | Table / Type            | How used by this feature                                      |
|-----------------|-------------------------|---------------------------------------------------------------|
| `PlannedMeal`   | `public.planned_meals`  | Created by `planSingleSlot()` when "Get Recommendation" is selected |
| `MealLog`       | `public.meal_logs`      | Created when user submits the MealLogger after "Log a Meal"   |
| `MealType`      | TypeScript union type   | Passed to picker and forwarded to server action / URL params  |

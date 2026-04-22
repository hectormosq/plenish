# UI Contract: CellActionPicker

## Component Interface

```typescript
interface CellActionPickerProps {
  /** The slot this picker is bound to */
  date: string;        // "YYYY-MM-DD"
  mealType: MealType;  // 'breakfast' | 'snack' | 'lunch' | 'dinner'

  /** Whether this slot is a future date (controls which actions are shown) */
  isFuture: boolean;

  /** Called when the user chooses "Get Recommendation" (future slots only) */
  onGetRecommendation: (mealType: MealType, date: string) => void;

  /** Called when the user chooses "Log a Meal" (all slots) */
  onLogMeal: (mealType: MealType, date: string) => void;

  /** Called when the picker is dismissed without action */
  onClose: () => void;
}
```

## Rendered Actions

| `isFuture` | Actions rendered                            |
|------------|---------------------------------------------|
| `true`     | "Get Recommendation" (primary) + "Log a Meal" (secondary) |
| `false`    | "Log a Meal" only                           |

## Dismissal Contract

The component MUST:
1. Call `onClose()` when the backdrop overlay is clicked
2. Call `onClose()` when `Escape` is pressed (keyboard event listener on mount)
3. Call the relevant action callback AND THEN implicitly dismiss (parent sets `activePicker = null`)

The component MUST NOT:
- Render more than one instance simultaneously (enforced by parent state — single `activePicker` value)
- Trigger `onGetRecommendation` for past slots

## Integration Points

### Trigger (MealWeekGrid.tsx)

```typescript
// State
const [activePicker, setActivePicker] = useState<ActivePicker>(null);

// Empty future cell onClick
onClick={() => setActivePicker({ date: dayKey, mealType })}

// Empty past cell onClick (NEW)
onClick={() => setActivePicker({ date: dayKey, mealType })}

// Picker handlers
const handlePickerRecommend = (mealType: MealType, date: string) => {
  setActivePicker(null);
  void handlePlanSlot(mealType, date);  // existing function
};

const handlePickerLogMeal = (mealType: MealType, date: string) => {
  setActivePicker(null);
  router.push(
    `/dashboard?prefillType=${encodeURIComponent(mealType)}&prefillDate=${encodeURIComponent(date)}`
  );
};
```

### MealLogger prefill (existing, no changes)

The "Log a Meal" action navigates to `/dashboard` with:
- `prefillType` → `initialMealType` in MealLogger
- `prefillDate` → `initialDate` in MealLogger
- No `prefillText` (user types the meal name)

This is the same URL-params pattern used by `handleAcceptPlanned`.

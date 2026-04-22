# Quickstart: Calendar Cell Action Picker

## What this feature does

Intercepts empty meal slot taps on the weekly calendar and shows a small action picker before anything happens. Future slots show two options; past slots show one.

## Files changed

| File | Change |
|------|--------|
| `src/components/ui/MealWeekGrid.tsx` | Add `activePicker` state, wire past cell clicks, replace direct `handlePlanSlot` trigger with picker open, add `handlePickerLogMeal` handler |
| `src/components/specific/CellActionPicker.tsx` | **New** — popover component (backdrop + card) |

No server actions, no schema migrations, no new routes.

## Implementing `CellActionPicker`

Model it on `MemberPickerPopover.tsx`:

```
Overlay (position: fixed, inset 0, z-index: 40, onClick: onClose)
  ↳ Card (position: absolute, centered on cell, z-index: 50)
       ↳ Title (meal type + date label)
       ↳ [if isFuture] Button "Get Recommendation" → onGetRecommendation
       ↳ Button "Log a Meal" → onLogMeal
```

Add `useEffect` for Escape key:
```typescript
useEffect(() => {
  const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}, [onClose]);
```

## Wiring in MealWeekGrid

1. Add state: `const [activePicker, setActivePicker] = useState<{ date: string; mealType: MealType } | null>(null);`

2. **Future cell**: Change `onClick={() => handlePlanSlot(mealType, dayKey)}` → `onClick={() => setActivePicker({ date: dayKey, mealType })}`

3. **Past empty cell**: Replace the ghost "—" `Cell` with a new `EmptyPastCell` that has `onClick={() => setActivePicker({ date: dayKey, mealType })}`

4. Render picker at end of grid JSX:
```tsx
{activePicker && (
  <CellActionPicker
    date={activePicker.date}
    mealType={activePicker.mealType}
    isFuture={activePicker.date >= todayKey}
    onGetRecommendation={(mt, d) => { setActivePicker(null); void handlePlanSlot(mt, d); }}
    onLogMeal={(mt, d) => { setActivePicker(null); router.push(`/dashboard?prefillType=${encodeURIComponent(mt)}&prefillDate=${encodeURIComponent(d)}`); }}
    onClose={() => setActivePicker(null)}
  />
)}
```

## Bilingual labels

Define string maps inside `CellActionPicker.tsx` until a project-wide i18n system is introduced:

```typescript
const LABELS = {
  en: { recommend: 'Get Recommendation', log: 'Log a Meal' },
  es: { recommend: 'Obtener recomendación', log: 'Registrar comida' },
};
```

Drive with `lang` prop (default `'es'` per `users.default_language`).

## Acceptance checklist

- [ ] Tapping empty future cell opens picker (no AI call yet)
- [ ] "Get Recommendation" closes picker + triggers `planSingleSlot` with correct date/type
- [ ] "Log a Meal" (future) navigates to `/dashboard?prefillType=...&prefillDate=...`
- [ ] Tapping empty past cell opens picker with only "Log a Meal"
- [ ] "Log a Meal" (past) navigates to `/dashboard` pre-filled with the past date
- [ ] Overlay click closes picker with no action
- [ ] Escape key closes picker with no action
- [ ] Opening picker on cell B while picker A is open → only B is shown
- [ ] `npm run build` passes with zero type errors

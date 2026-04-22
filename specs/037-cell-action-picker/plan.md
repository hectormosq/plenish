# Implementation Plan: Calendar Cell Action Picker

**Branch**: `037-cell-action-picker` | **Date**: 2026-04-21 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/037-cell-action-picker/spec.md`

## Summary

Intercept empty meal slot taps on the weekly calendar with a small action picker. Future slots offer "Get Recommendation" (existing AI flow) and "Log a Meal" (navigate to MealLogger pre-filled). Past slots offer only "Log a Meal" (retroactive logging). No schema changes — entirely transient UI state added to `MealWeekGrid.tsx` plus a new `CellActionPicker` component.

## Technical Context

**Language/Version**: TypeScript 5.x / React 18 (Next.js 14)  
**Primary Dependencies**: styled-components, Supabase JS SDK, Vercel AI SDK  
**Storage**: Supabase PostgreSQL — no new tables or migrations needed  
**Testing**: No test infrastructure present in project  
**Target Platform**: Web (Next.js App Router, responsive — mobile + desktop)  
**Project Type**: Web application  
**Performance Goals**: Picker open/close < 100ms (pure client state)  
**Constraints**: No Tailwind, TypeScript strict mode, no inline Supabase clients, bilingual (en/es)  
**Scale/Scope**: Two files changed, one new component

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Rule | Status | Notes |
|------|--------|-------|
| No Tailwind CSS | ✅ PASS | CellActionPicker uses styled-components exclusively |
| No inline Supabase client | ✅ PASS | No Supabase calls in new component |
| No hardcoded user IDs | ✅ PASS | Slot identity passed as props, not hardcoded |
| No mocked data in production paths | ✅ PASS | No stubs introduced |
| TypeScript strict mode | ✅ PASS | All props typed; `npm run build` required before PR |
| Spec-driven (product_spec + schema cross-ref) | ✅ PASS | No schema changes; spec aligns with existing `planned_meals` + `meal_logs` |
| Server Actions for mutations | ✅ PASS | `planSingleSlot` (existing) and MealLogger (existing) used — no new mutations |
| Bilingual by default | ⚠️ CONFLICT | Constitution requires translation files; project has none. Labels defined as inline string maps following existing pattern. Deferred to i18n sprint. |

**Post-Phase-1 re-check**: PASS — design introduces no new violations beyond the pre-existing i18n gap.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Inline bilingual string maps instead of translation files | Project has no i18n infrastructure; introducing next-intl in one PR violates Principle V | A proper i18n system is cross-cutting — this feature follows existing code pattern pending a dedicated i18n sprint |

## Project Structure

### Documentation (this feature)

```text
specs/037-cell-action-picker/
├── plan.md              ← this file
├── research.md          ← Phase 0 (complete)
├── data-model.md        ← Phase 1 (complete)
├── quickstart.md        ← Phase 1 (complete)
├── contracts/
│   └── cell-action-picker.md  ← Phase 1 (complete)
└── tasks.md             ← Phase 2 (/speckit.tasks — not yet created)
```

### Source Code

```text
src/
├── components/
│   ├── ui/
│   │   └── MealWeekGrid.tsx          ← MODIFIED (activePicker state, past cell click, picker render)
│   └── specific/
│       └── CellActionPicker.tsx      ← NEW (popover component)
└── (no other files changed)
```

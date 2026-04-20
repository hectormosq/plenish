# Implementation Plan: Structured Meal Recommendations with Ingredients and Instructions

**Branch**: `036-structured-meal-recommendations` | **Date**: 2026-04-17 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/036-structured-meal-recommendations/spec.md`

## Summary

`ingredients` already exists in the DB, AI schema, and server actions. The three remaining pieces are: (1) add `instructions` field end-to-end (migration → AI schema → action → UI), (2) expand/collapse toggle on planned meal cells, (3) optional ingredient hint param on regenerate with a small inline input in the calendar.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)  
**Primary Dependencies**: Zod (AI output schema), Supabase (migration + insert), styled-components (new cell UI)  
**Storage**: PostgreSQL — add `instructions text` column to `planned_meals`  
**Testing**: Manual — plan a slot, expand cell, verify instructions; regen with/without hint; `npm run build` gate  
**Target Platform**: Web (desktop + mobile)  
**Project Type**: Web application  
**Performance Goals**: Expand/collapse is instant (client-side only); no extra network requests  
**Constraints**: No Tailwind; styled-components only; migration required before code changes  
**Scale/Scope**: 1 migration, 3 source files changed

## Constitution Check

| Gate | Status | Notes |
|------|--------|-------|
| Spec-driven (cross-ref product_spec.md) | ✅ Pass | Extends existing planned meals feature |
| Schema change requires migration | ✅ Required | `00009_planned_meals_instructions.sql` |
| Update `docs/database_schema.md` | ✅ Required | After migration |
| Data mutations via Server Actions only | ✅ Pass | `plans.ts` handles all mutations |
| Auth from `supabase.auth.getUser()` | ✅ Pass | Already in `plans.ts`, unchanged |
| No Tailwind CSS | ✅ Pass | styled-components only |
| TypeScript strict / zero build errors | ✅ Must verify |
| Bilingual support | ✅ Pass | No new user-facing copy beyond UI labels |

## Project Structure

### Documentation (this feature)

```text
specs/036-structured-meal-recommendations/
├── plan.md         ✅ this file
├── research.md     ✅ generated
├── data-model.md   ✅ generated
├── quickstart.md   ✅ generated
└── tasks.md        — /speckit.tasks output
```

### Source Code

```text
supabase/migrations/
└── 00009_planned_meals_instructions.sql   ← NEW

docs/
└── database_schema.md                     ← update planned_meals entry

src/lib/ai/
└── getRecommendation.ts                   ← add instructions to schema + hint param

src/actions/
└── plans.ts                               ← add instructions to interface + inserts + regenerateSlot hint

src/components/ui/
└── MealWeekGrid.tsx                       ← expand/collapse state + cell UI + regen hint input
```

## Complexity Tracking

No constitution violations. Migration is required and justified — new persistent field.

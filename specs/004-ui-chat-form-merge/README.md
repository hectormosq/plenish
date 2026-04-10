# Phase 1 Spec: Merge Chat + Log Form UI

**Status**: Ready for Implementation  
**Branch**: `004-ui-chat-form-merge`  
**Priority**: P1 (Foundation for all subsequent UI phases)  
**Estimated Time**: 4-5 hours

## Overview

Consolidate the standalone `AIChatBox` and `LogMealForm` components into a unified `MealLogger` component. Replace the meal type dropdown with optional meal type chips. Implement the visual 3-state share button (logic deferred to Phase 3).

This is the foundation for the entire dashboard UX redesign.

---

## What's in This Folder

| File | Purpose |
|------|---------|
| **spec.md** | Feature requirements, user scenarios, acceptance criteria |
| **plan.md** | Technical implementation plan, file changes, testing strategy |
| **research.md** | Codebase patterns, reusable code, design decisions |
| **tasks.md** | 31 granular tasks organized in 8 groups (~4.5 hours) |
| **checklists/requirements.md** | Functional/UX/technical requirements checklist |
| **README.md** | This file |

---

## Quick Start

1. **Understand** the feature by reading `spec.md` (scenario, requirements, success criteria)
2. **Plan** the implementation by reading `plan.md` (what files to create/modify, pseudocode)
3. **Research** reusable code by reading `research.md` (copy-paste patterns from existing components)
4. **Execute** the tasks by following `tasks.md` (31 concrete tasks, ~4.5 hours)
5. **Verify** requirements using `checklists/requirements.md` (before merging)

---

## Key Design Decisions

### Why Consolidate?
- **Reduces nesting**: Wrapper → Component → UI becomes just Component
- **Simplifies state**: Chat + form in one component (no prop drilling)
- **Natural UX**: Single input for both chat and meal logging
- **Easier to extend**: Phases 2-7 build on this unified interface

### What's New?
- **Meal Type Chips**: Toggleable buttons replacing the dropdown (optional context hints)
- **3-State Share Button**: Visual states show sharing intent (logic in Phase 3)
- **Unified Input**: One text field for both chat + meal logging

### What's Unchanged?
- Chat functionality (Vercel AI SDK, streaming messages)
- Meal logging (server action, database persistence)
- Household sharing (co-eater selection deferred to Phase 3)
- Dashboard layout (60/40 split on desktop, stacked on mobile)

---

## Dependencies

Before implementing:
- Existing styled-components setup ✅
- Vercel AI SDK (@ai-sdk/react) ✅
- Next.js App Router ✅
- Supabase RLS for meal logs ✅

No new dependencies needed.

---

## After Phase 1

**Next Phase**: Phase 2 — Weekly Meal Calendar
- Replace flat "Recent Activity" list with a grid showing breakfast/lunch/dinner slots per day
- Depends on: MealLogger working correctly

---

## Help

- **Questions on spec**: See `spec.md` requirements and acceptance scenarios
- **Questions on implementation**: See `plan.md` pseudocode and implementation strategy
- **Questions on reusing code**: See `research.md` code snippets and patterns
- **Questions on tasks**: See `tasks.md` granular checklist with explanations

---

**Ready to start? Open `tasks.md` and begin with Task Group 1! 🚀**

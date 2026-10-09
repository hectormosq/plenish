---
name: plenish-context
description: Core context and rules for working on the Plenish Next.js application.
---

# Plenish Context

## Goal
Plenish records eaten meals and recommends meals (per-slot and weekly plans, updateable on demand). It supports English and Spanish and is built primarily for a Spanish-speaking audience.

## Stack
- **Framework:** Next.js 16.2.1 (App Router, strict TypeScript). Request middleware lives in `src/proxy.ts`.
- **Styling:** styled-components 6 (NO Tailwind CSS). Dark-mode first. SSR wrapper in `src/lib/registry.tsx`.
- **Database:** Supabase (PostgreSQL, RLS on every table, pgvector enabled but unused).
- **Auth:** Supabase Google OAuth with SSR cookie refresh.
- **AI:** Vercel AI SDK (`ai`) with `@ai-sdk/google` and `@ai-sdk/openai`; provider chosen by `PLENISH_AI_PROVIDER`.
- **Workspace:** `packages/ai-session-logger` (built before `next build`).

## What exists
- Auth: `/login` → `/dashboard` (protected), `/settings`, `/history`, `/recipes`.
- Meal logging through chat and form: `MealLogger`, `src/actions/meals.ts`, `/api/chat`.
- Weekly calendar (`MealWeekGrid`) with planned meals: accept, regenerate, dismiss (`src/actions/plans.ts`).
- Households: invitations, shared meals, co-eaters (`src/actions/households.ts`).
- AI chat with tools for logging, editing, summaries and planning.

Not real yet: `NutritionGoals.tsx` is hardcoded and unused; `recipes.embedding` is never written.

## Architecture rules
1. styled-components only. `'use client'` on every file that uses styled-components.
2. Data mutations go in Server Actions under `src/actions/`. Never `fetch()` an `/api/` route from a client component to mutate data.
3. Supabase clients come from `src/lib/supabase/` (`client.ts` browser, `server.ts` RSC and Server Actions). Never create one inline.
4. Always derive the user from `supabase.auth.getUser()`. Never hardcode `user_id`.
5. New tables need RLS policies and a migration file in `supabase/migrations/`.

## Dashboard slot pattern
1. Create an async Server Component fetcher (no `'use client'`).
2. Pass it as a slot prop to `DashboardLayout`.
3. Wrap it in `<Suspense>` with a skeleton fallback in `src/app/dashboard/page.tsx`.

Reference: `src/components/specific/RecentMeals.tsx` + `RecentMealsList.tsx`.

## Working rules
1. Before large changes, cross-reference `docs/product_spec.md` and `docs/database_schema.md`.
2. Run `npm run build` before finalizing any change; it must pass with zero type errors.
3. Work on a feature branch (`<number>-<kebab-slug>`) and open a PR. Never commit to `main`.

Area-specific rules load from `.claude/rules/` when matching files are touched: `ui-components.md`, `database.md`, `ai.md`.

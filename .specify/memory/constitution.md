# Plenish Constitution

## Core Principles

### I. User-First Nutrition Intelligence
Plenish exists to remove the cognitive load of eating well. Every feature must serve one of three user outcomes: logging what was eaten, understanding nutritional progress, or deciding what to eat next. Features that do not serve a clear outcome are not built.

### II. AI as Advisor, Not Oracle
The AI recommendation engine surfaces suggestions — the user always has the final word. Recommendations must be explainable (why this meal?), replaceable (user can swap any suggestion), and grounded in real data (meal history + nutrition goals). Never generate recommendations without user context.

### III. Spec-Driven Development (NON-NEGOTIABLE)
All new features must be cross-referenced against `docs/product_spec.md` and `docs/database_schema.md` before implementation begins. No schema changes without a migration file in `supabase/migrations/`. No UI that contradicts the spec is merged.

### IV. Typed, Server-Authoritative Data Layer
Data mutations happen exclusively through Server Actions in `src/actions/`. Client components never call `/api/` routes for mutations. All user identity is derived from `supabase.auth.getUser()` — never hardcoded or passed as props. RLS policies protect every table.

### V. Consistency Over Cleverness
The codebase uses one styling system (styled-components), one AI provider abstraction (`src/lib/ai/provider.ts`), one Supabase client pattern (`src/lib/supabase/`), and one dashboard composition pattern (slot props + Suspense). Introducing a second way to do anything requires explicit justification and team agreement.

## Technical Constraints

- **No Tailwind CSS** — styled-components exclusively; dark-mode first aesthetic
- **No inline Supabase client instantiation** — always use `src/lib/supabase/client.ts` or `server.ts`
- **No hardcoded user IDs or content** — all data must be user-scoped via auth
- **No mocked data in production paths** — stubs (`CurrentRecommendation`, `NutritionGoals`) must be replaced before a feature is considered done
- **TypeScript strict mode** — zero type errors required; run `npm run build` before finalizing any change
- **Multilanguage by default** — UI copy must use a translated key and translation files for english and spanish

## Development Workflow

1. **Spec first** — consult `docs/product_spec.md` before opening any file
2. **Schema changes** — write migration, update `docs/database_schema.md`, then code
3. **New dashboard data** — follow the slot pattern: async Server Component fetcher → slot prop → `<Suspense>` with skeleton
4. **AI features** — use `getAIModel()` from `src/lib/ai/provider.ts`; prefer `generateObject` + Zod schema for structured outputs
5. **Build gate** — `npm run build` must pass with zero errors before any PR is considered ready

## Conflict Detection & Governance Evolution

**Before executing any request**, check for conflicts across all governance files:
- This constitution
- `docs/product_spec.md`
- `docs/database_schema.md`
- `README.md`
- `CLAUDE.md` / `AGENTS.md`
- Any other file used as a guideline or reference

If the user's prompt conflicts with any of these files — or if these files conflict with each other — **stop and surface the conflict explicitly** before doing any work. Use this format:

```
CONFLICT DETECTED
- Your prompt says: [X]
- [governance file] says: [Y]
- Recommendation: [update the spec / update the constitution / clarify intent]
```

Do not silently resolve conflicts by picking one side. The goal is to keep all governance files consistent and accurate. When a conflict is found, the user decides which source of truth wins, then both files are updated to reflect that decision.

This applies equally to conflicts between governance files themselves — if `product_spec.md` contradicts the constitution, flag it.

## Governance

This constitution supersedes all other conventions in the codebase. When a practice conflicts with these principles, the constitution wins. Amendments require updating this file with a rationale comment and incrementing the version.

All code review must verify:
- Spec compliance (`docs/product_spec.md`)
- No Tailwind, no inline Supabase clients, no hardcoded user data
- Build passes with zero type errors
- Bilingual support preserved

**Version**: 1.0.0 | **Ratified**: 2026-04-07 | **Last Amended**: 2026-04-07

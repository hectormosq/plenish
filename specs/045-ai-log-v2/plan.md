# Implementation Plan: AI Meal Logging v2 — Ingredient Inference

**Branch**: `045-ai-log-v2` | **Date**: 2026-10-19 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/045-ai-log-v2/spec.md`

## Summary

Add a second chat meal-logging pipeline (v2) beside the current one (v1). v2 is a code-driven chain of six swappable nodes — `parse → history → ingredients → portions → nutrition → gate` — that turns a vague message into ingredient rows with estimated grams (no kcal/macros — R12), then saves (high confidence), asks for confirmation through an editable table (medium), or asks an open question (low). A per-user preference on a new Preferences page selects v1, v2 or (whitelisted developers only) v2 + shadow v1, where v1 runs after the response without writing data. Every run is stored in `ai_pipeline_runs` with tokens, estimated cost and latency, so both variants can be compared on the same messages.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node.js runtime for the chat route
**Primary Dependencies**: Next.js 16.2.1 (App Router, `after()` from `next/server`), AI SDK 6 (`generateText` + `Output.object`, `createUIMessageStream`, data parts), `@ai-sdk/google` / `@ai-sdk/openai`, Zod 4, styled-components 6, lucide-react. **No new dependencies.**
**Storage**: Supabase PostgreSQL — migration `00010_ai_log_v2.sql` (4 new tables, 2 new columns on `meal_logs`), RLS on all
**Testing**: vitest — new `npm run test` for unit tests under `src/**/*.test.ts`; `npm run eval` (existing + new `log-v2.eval.ts`); `npm run build`
**Target Platform**: Vercel (serverless Node), modern browsers, mobile-first chat
**Project Type**: Web application (single Next.js project + `packages/ai-session-logger` workspace)
**Performance Goals**: v2 reply for a typical one-dish message within ~1.5× v1 latency (measured, not gated); shadow adds 0 ms to the reply (runs in `after()`)
**Constraints**: ≤ 4 model calls for a new single-dish meal, ≤ 2 for a repeated one (router + parse); no data writes from shadow runs; every value from the client re-validated on the server
**Scale/Scope**: single-digit active users today; ~20 new files, 1 migration, 2 new pages/components groups

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. User-First Nutrition Intelligence | ✅ | Serves "logging what was eaten" and feeds "understanding progress". |
| II. AI as Advisor, Not Oracle | ✅ | User confirms or edits whenever confidence isn't high; auto-saved meals stay editable; values labelled as estimates. |
| III. Spec-Driven Development | ✅ | Spec + data model written first; migration `00010` + `docs/database_schema.md` update in the same change. |
| IV. Typed, Server-Authoritative Data Layer | ✅ | Mutations via `src/actions/preferences.ts` and `src/actions/meal-drafts.ts`; user from `auth.getUser()`; drafts re-validated server-side; RLS on every new table. |
| V. Consistency Over Cleverness — experimental variants (1.1.0) | ✅ | Comparison goal, default v1, variant tagged on every run, decision + retirement in spec §Variant Decision. One provider abstraction (`getAIModel`), one Supabase pattern. |
| No Tailwind / no inline Supabase clients / no hardcoded users | ✅ | styled-components; `src/lib/supabase/server.ts`. |
| No mocked data in production paths | ✅ | — |
| TypeScript strict, build gate | ✅ | `npm run build` in quickstart gates. |
| Multilanguage by default | ⚠️ → ✅ | **Pre-existing gap**: the app has no translation system (copy is hardcoded). This feature adds `src/lib/i18n/{es,en}.ts` + `t()` and uses it for all of its own strings (R9). Migrating existing copy → follow-up task. |
| AI rules (`.claude/rules/ai.md`) | ✅ | User re-derived in nodes/actions (1); shadow restricted to `log` in code (2); no repeated tool instructions (3); lenient model schemas cleaned in code (4); `tzOffset` for dates (5); model ids and prices only in `provider.ts` (6); evals run (7); `mixed` agent gets only `log_meal_v2` swapped in (8). |
| Workflow §4 "prefer `generateObject`" | ✅ | AI SDK 6 deprecates `generateObject`; the codebase already uses `generateText` + `Output.object` (router, recommendations). Followed for consistency. |

**Post-design re-check (after Phase 1)**: no new violations. The `MealDraft` round-trip through the client was checked against IV: the draft only ever describes the authenticated user's own meal, ids are verified against the user's rows, and derived fields are recomputed on the server.

## Project Structure

### Documentation (this feature)

```text
specs/045-ai-log-v2/
├── spec.md
├── plan.md              # this file
├── research.md          # R1–R12 decisions
├── data-model.md        # tables, RLS, migration outline, draft states
├── quickstart.md        # manual scenarios, comparison SQL, gates
├── contracts/
│   ├── meal-draft.md    # MealDraft schema, stream parts, i18n keys
│   ├── pipeline-nodes.md
│   └── server-actions.md
├── checklists/requirements.md
└── tasks.md             # next: /speckit-tasks
```

### Source Code (repository root)

```text
supabase/migrations/
└── 00010_ai_log_v2.sql                    # NEW

src/lib/ai/
├── provider.ts                            # + MODEL_PRICES, estimateCost()
├── provider.test.ts                       # NEW — estimateCost
├── router.ts                              # returns usage; internal `revise` intent when a draft is pending
├── chat-turn.ts                           # + optional route, logPipeline inputs
├── save-meal.ts                           # NEW — saveMealLogToDb extracted from meal-tools.ts
├── runs.ts                                # NEW — insert/update ai_pipeline_runs
├── shadow.ts                              # NEW — runShadowV1 (after())
├── tools/
│   ├── meal-tools.ts                      # uses save-meal.ts; sets log_pipeline='v1'
│   └── log-v2-tool.ts                     # NEW — log_meal_v2 for the mixed agent
└── log-v2/                                # NEW
    ├── types.ts  config.ts  schemas.ts
    ├── dish-key.ts                        # normalizeDishKey
    ├── parse.ts  history.ts  ingredients.ts  portions.ts  nutrition.ts  gate.ts  revise.ts
    ├── pipeline.ts                        # runLogPipelineV2
    ├── save.ts                            # saveMealV2
    ├── preferences.ts                     # getEffectivePipeline
    ├── reply.ts                           # template replies via i18n
    └── *.test.ts                          # dish-key, gate, portions, schemas

src/lib/i18n/                              # NEW — es.ts, en.ts, index.ts (t, Lang)

src/app/api/chat/route.ts                  # pipeline selection, revise, v2 stream, shadow, v1 run rows
src/app/preferences/
├── page.tsx                               # NEW — Server Component, reads getPreferences()
└── PreferencesLayout.tsx                  # NEW — mirrors SettingsLayout

src/actions/
├── preferences.ts                         # NEW
└── meal-drafts.ts                         # NEW

src/components/
├── ui/
│   ├── Alert.tsx                          # NEW — estimated-values alert (generic)
│   └── RadioCardGroup.tsx                 # NEW — option list for Preferences (generic)
├── specific/
│   ├── MealDraftTable.tsx                 # NEW — read-only / editable ingredient table
│   ├── LogPipelinePreference.tsx          # NEW — client form for the preference
│   ├── MealLogger.tsx                     # renders data-meal-draft + tool-log_meal_v2 parts
│   └── RecentMealsList.tsx                # estimated badge for is_estimated meals
└── layout/MobileBottomNav.tsx             # + Preferences entry
src/app/dashboard/DashboardLayout.tsx      # + Preferences link next to Settings

evals/
├── datasets/log-v2.json                   # NEW — 20 dishes with expected main ingredients
└── log-v2.eval.ts                         # NEW

docs/database_schema.md                    # 4 tables + meal_logs columns
.claude/rules/database.md                  # "Tables in use" list
.claude/rules/ai.md                        # layout entries for log-v2/, shadow, runs
package.json                               # + "test" script
```

**Structure Decision**: Single Next.js project, following existing locations: AI code under `src/lib/ai/` (new `log-v2/` folder keeps the experiment isolated so it can be deleted or promoted as a unit, per §Variant Decision), mutations under `src/actions/`, generic UI under `src/components/ui/`, domain UI under `src/components/specific/`.

## Implementation phases (see tasks.md)

1. **Foundation** — eval baseline; migration `00010`; docs; `save-meal.ts` extraction (evals unchanged); `runs.ts`; `MODEL_PRICES`; router usage + `revise` intent; `i18n`; `npm run test`.
2. **US1 (P1)** — nodes `parse`, `ingredients`, `portions`, `nutrition`, `gate` (+ `history` stub); `pipeline.ts`; `saveMealV2`; route v2 path; `log_meal_v2` for `mixed`; `MealDraftTable` (read-only) + `Alert`; v1 runs. Enabled per user with one SQL row.
3. **US3 (P3)** — real `history` node. **Merged together with US1** so the stub never reaches `main`.
4. **US2 (P2)** — `revise` node via the router intent; editable table; `meal-drafts` actions; saved-meal corrections only after confirmation.
5. **US4 (P4)** — Preferences page and nav; `shadow.ts` with `after()`.
6. **Polish** — estimated badge on meal views; `log-v2` eval incl. history cases; rules/docs; quickstart; `npm run build`.

## Risks

| Risk | Mitigation |
|------|------------|
| Model confidence poorly calibrated | Thresholds in config; raw score stored; tuned from `confirm_rate`/`correction_rate`. |
| Draft tampering from the client | Only affects the user's own meal; ids checked; derived fields recomputed. |
| Extra call after every v2 log to detect corrections | Corrections are a router intent (`revise`) offered only when a draft is pending; other intents drop the draft with no extra call. |
| Latency of 3–4 sequential calls | Ingredient calls in parallel; history skips calls; latency recorded per step for comparison. |
| Shadow v1 accidentally writing data | Shadow only for `log`; `saveMealLog` replaced by a no-op; no other tools given. |
| `after()` cut short by function timeout | Shadow row may be missing → visible as unpaired `correlation_id`; acceptable for a dev tool. |

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Two logging pipelines side by side | Compare quality, cost and observability before choosing (spec §Variant Decision) | Replacing v1 directly leaves nothing to compare against; allowed by constitution §V 1.1.0 |
| Minimal i18n module added by a feature | Constitution requires translated EN/ES copy and no system exists | Hardcoding strings would add to the existing violation; full `next-intl` migration is out of scope |

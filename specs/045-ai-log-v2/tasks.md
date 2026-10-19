---
description: "Task list for AI Meal Logging v2 — Ingredient Inference"
---

# Tasks: AI Meal Logging v2 — Ingredient Inference

**Input**: Design documents from `specs/045-ai-log-v2/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (meal-draft, pipeline-nodes, server-actions), quickstart.md

**Tests**: Included. The plan (research R11) asks for unit tests of the code-only nodes and helpers, a new `log-v2` eval, and the existing evals as the v1 regression gate (SC-007).

**Organization**: Grouped by user story. US1–US3 can be tested before the Preferences page exists by inserting a `user_preferences` row with SQL (quickstart §1); US4 adds the page and shadow mode.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1–US4 from spec.md
- All paths are relative to the repository root `C:\dev\plenish`

## Ground rules for every task

- Read `AGENTS.md`, `.claude/rules/ai.md`, `.claude/rules/database.md`, `.claude/rules/ui-components.md` before the first task that touches those areas.
- Next.js 16 differs from older versions: check `node_modules/next/dist/docs/` before using a Next API (e.g. `after`, route handlers).
- `'use client'` on every file using styled-components; no Tailwind; Supabase clients only from `src/lib/supabase/`.
- Every server function derives the user with `supabase.auth.getUser()`; never accept a user id from the client or the model.
- All new user-facing text goes through `t()` from `src/lib/i18n` (Spanish and English).

---

## Phase 1: Setup

**Purpose**: Test runner, translations and config used by later phases

- [ ] T001 Add a root `vitest.config.ts` that resolves the `@/` alias to `src/` and includes only `src/**/*.test.ts`; add `"test": "vitest run --config vitest.config.ts"` to `package.json` scripts (keep `eval` untouched)
- [ ] T002 [P] Create the translation module in `src/lib/i18n/index.ts` (`type Lang = 'es' | 'en'`, `t(lang, key, vars?)` with `{var}` interpolation, fallback to `es`), `src/lib/i18n/es.ts` and `src/lib/i18n/en.ts` with every `logV2.*` key from `specs/045-ai-log-v2/contracts/meal-draft.md` plus `preferences.*` keys (page title, "Registro de comidas por chat", option labels/descriptions for v1, v2, v2 + shadow v1, developer-tool cost note, saved/error messages)
- [ ] T003 [P] Create `src/lib/ai/log-v2/config.ts` with `CONFIDENCE_HIGH = 0.85`, `CONFIDENCE_LOW = 0.50`, `MAX_DISHES = 10`, `MAX_INGREDIENTS_PER_DISH = 40`, `DEFAULT_QUANTITY_G = 100`

---

## Phase 2: Foundational (blocks all stories)

**Purpose**: Schema, shared write path, run telemetry and pipeline selection

**⚠️ No user story work until this phase is complete**

- [ ] T004 Write `supabase/migrations/00010_ai_log_v2.sql` exactly as `specs/045-ai-log-v2/data-model.md` §1–§7: tables `developer_whitelist`, `user_preferences`, `meal_log_ingredients`, `ai_pipeline_runs`; columns `meal_logs.log_pipeline`, `meal_logs.is_estimated`; function `is_developer(uuid)` (SECURITY DEFINER, STABLE, `SET search_path = public`); trigger `user_preferences_guard` raising `shadow_requires_developer`; all indexes, RLS enables and policies; closing comment showing how to whitelist a developer
- [ ] T005 [P] Update `docs/database_schema.md` with the four new tables and the two `meal_logs` columns (purpose, columns, RLS notes), following the existing section style
- [ ] T006 [P] Add the four new tables to the "Tables in use" table in `.claude/rules/database.md`
- [ ] T007 Before any code change, run `npm run eval` on the branch and record the result file names and headline scores in `specs/045-ai-log-v2/eval-baseline.md`; this is the v1 baseline for T009 and T056
- [ ] T008 Extract `saveMealLogToDb` from `src/lib/ai/tools/meal-tools.ts` into `src/lib/ai/save-meal.ts` as `saveMealLog(meal, extra?: { log_pipeline?: 'v1' | 'v2' | null; is_estimated?: boolean })` returning the same result object (meal insert, household/co-eater resolution, recipe suggestion, planned-meal override, `revalidatePath('/dashboard')`); make `meal-tools.ts` use it, with `logMealTool` passing `log_pipeline: 'v1'` and `formLogMealTool` passing nothing (null); keep `SaveMealLog` and the `saveMealLog` option working for the evals
- [ ] T009 Run `npm run eval` and compare with `specs/045-ai-log-v2/eval-baseline.md`; results must match (no v1 behaviour change after T008)
- [ ] T010 [P] Add `MODEL_PRICES: Record<string, { inputPerM: number; outputPerM: number }>` for the models in `src/lib/ai/provider.ts` (values from the providers' pricing pages, dated in a comment) and `estimateCost(model: string, inputTokens: number, outputTokens: number): number | null`
- [ ] T011 [P] Extend `RouteDecision` in `src/lib/ai/router.ts` with `usage: { inputTokens: number; outputTokens: number; latencyMs: number }` taken from the `generateText` result (zeros for the keyword fallback); update callers so types compile
- [ ] T012 Add the internal `revise` intent to `src/lib/ai/router.ts` per research R3: `routeMessage(model, text, previous, { draftPending })`; only when `draftPending` is true, the schema enum and the prompt include `revise` ("the user confirms, corrects or cancels the meal shown above"); `keywordRoute` maps `sí|si|vale|ok|no|sin|con|quita|añade|cambia|yes|remove|add` to `revise` only when `draftPending`; `revise` is never returned when `draftPending` is false; add routing cases to `evals/datasets/routing.json` with and without a pending draft
- [ ] T013 Create `src/lib/ai/runs.ts` with `insertRun(supabase, row)` returning the run id and `updateRun(supabase, runId, patch)` for `ai_pipeline_runs` (typed row per data-model §4; `user_id` from `auth.getUser()`; errors logged with `console.warn`, never thrown to the caller)
- [ ] T014 [P] Create `src/lib/ai/log-v2/preferences.ts` with `getEffectivePipeline(supabase, userId): Promise<'v1' | 'v2' | 'v2_shadow_v1'>` — parallel selects of `user_preferences` and `developer_whitelist`; no row → `v1`; `v2_shadow_v1` without a whitelist row → `v2` (research R8)
- [ ] T015 [P] Create `src/lib/ai/log-v2/types.ts` (`NodeContext`, `StepUsage`, `PipelineNode<In, Out>`, `ParsedDish`, `ResolvedDish`) and `src/lib/ai/log-v2/schemas.ts` (`MealDraft`, `DraftDish`, `DraftIngredient` Zod schemas and types exactly as `contracts/meal-draft.md`; `PlenishUIMessage = UIMessage<never, { 'meal-draft': MealDraft }>`)
- [ ] T016 [P] Create `src/lib/ai/log-v2/dish-key.ts` with `normalizeDishKey(name)` (lower-case, NFD accent strip, collapse whitespace, drop leading articles/numbers `un|una|unos|unas|el|la|los|las|a|an|the|\d+`) per research R5
- [ ] T017 Add optional `route?: RouteDecision` and `logPipeline?: 'v1' | 'v2' | 'v2_shadow_v1'` inputs to `buildChatTurn` in `src/lib/ai/chat-turn.ts`; when `route` is given, skip `routeMessage`; default behaviour unchanged for the evals
- [ ] T018 In `src/app/api/chat/route.ts`: create `correlationId = crypto.randomUUID()`, call `getEffectivePipeline`, call `routeMessage` once and pass it into `buildChatTurn`; in `streamText` `onFinish`, **only for `log`, `mixed` and form turns**, write a run with `insertRun` (`variant` = the user's effective pipeline (`v1`, or `v2` for a v2 user's `mixed` turn), `intent` `log`/`mixed`/`form`, tokens = `totalUsage` + router usage, `est_cost_usd` via `estimateCost`, `latency_ms` = request start → `onFinish`, `first_token_ms` in the agent step `summary` (from the first `onChunk`), `steps` = router + agent, `meal_log_id` from the `log_meal` tool result when present, `outcome 'saved'` or null); manage, plan and chat turns write no run
- [ ] T019 [P] Unit tests in `src/lib/ai/log-v2/dish-key.test.ts` (accents, articles, spacing, "Arepa Catira" = "arepa catira" = "una arepa catira") and `src/lib/ai/provider.test.ts` (`estimateCost` known model, unknown model → null)

**Checkpoint**: Migration applied, `npm run test` and `npm run eval` green, v1 chats now write `ai_pipeline_runs` rows.

---

## Phase 3: User Story 1 — Log a vague dish and get an ingredient breakdown (P1) 🎯 MVP

**Goal**: A v2 user writes a dish name; the meal is saved with ingredient rows when confidence is high, and the reply shows the table with the estimated alert.

**Independent Test**: `INSERT INTO user_preferences (user_id, log_pipeline) VALUES (<you>, 'v2')`; chat "desayuné dos huevos fritos con pan" → meal saved, `meal_log_ingredients` rows exist, table and alert shown (quickstart #2, #8).

### Tests for User Story 1

- [ ] T020 [P] [US1] Unit tests in `src/lib/ai/log-v2/gate.test.ts` (dish levels at 0.85/0.50 boundaries, history and user-listed → high, meal level = lowest, actions save/confirm/ask), `src/lib/ai/log-v2/portions.test.ts` (stated grams override with `stated`, others `estimated`, non-positive grams → default) and `src/lib/ai/log-v2/schemas.test.ts` (valid draft passes, missing ingredients / bad uuid / quantity ≤ 0 fail)

### Implementation for User Story 1

- [ ] T021 [P] [US1] Implement the `parse` node in `src/lib/ai/log-v2/parse.ts`: one `generateText` + `Output.object` call returning language, meal_type (with `.catch` to a time-of-day default computed from `tzOffsetMinutes`), eaten_at, and dishes `{ dish_name (canonical, no quantities), stated_quantities, listed_ingredients }`; drop empty dish names; cap at `MAX_DISHES`; return `StepUsage`
- [ ] T022 [P] [US1] Implement the `ingredients` node in `src/lib/ai/log-v2/ingredients.ts`: one call per dish returning `{ confidence, ingredients: { name, quantity_g }[] }` with standard portions (e.g. entrecôte 250 g); include the scoring rubric from spec §Confidence in the prompt; clamp confidence to [0,1]; ingredient names in the parsed language; if the user listed ingredients, use them and score 1
- [ ] T023 [P] [US1] Implement the `portions` node in `src/lib/ai/log-v2/portions.ts` (code only): apply `stated_quantities` by name match, set `quantity_source` (`stated` | `estimated`), replace non-positive grams with `DEFAULT_QUANTITY_G`
- [ ] T024 [P] [US1] Implement the `nutrition` node in `src/lib/ai/log-v2/nutrition.ts`: one call producing the existing `NutritionSchema` from `src/lib/ai/nutrition-schemas.ts` for the whole meal from resolved dishes and grams (no kcal/macros, research R12); strip zero servings like `cleanNutrition` in `meal-tools.ts`
- [ ] T025 [P] [US1] Implement the `gate` node in `src/lib/ai/log-v2/gate.ts` (code only) per spec §Confidence Levels & Thresholds using `config.ts`
- [ ] T026 [P] [US1] Create the `history` node in `src/lib/ai/log-v2/history.ts` with the final input/output types from `contracts/pipeline-nodes.md` and a temporary implementation that returns no matches (real lookup in T042)
- [ ] T027 [US1] Implement `saveMealV2(supabase, userId, draft, runId)` in `src/lib/ai/log-v2/save.ts`: call `saveMealLog` from `src/lib/ai/save-meal.ts` with `log_pipeline 'v2'`, `is_estimated true`, `nutrition` from the draft and `inferred_ingredients` as `"<name> (<g> g)"`; then insert `meal_log_ingredients` rows (server-computed `dish_key`, `position`, `confidence_*`); on ingredient insert failure delete the meal and return an error
- [ ] T028 [P] [US1] Implement `buildReply(outcome, draft, lang)` in `src/lib/ai/log-v2/reply.ts` returning the template text via `t()` (`logV2.saved`, `logV2.confirm`, `logV2.question`, `logV2.error`)
- [ ] T029 [US1] Implement `runLogPipelineV2` in `src/lib/ai/log-v2/pipeline.ts` per `contracts/pipeline-nodes.md`: parse → history → ingredients (parallel, unmatched dishes only) → portions → nutrition → gate; build the `MealDraft`; insert the v2 run first (`insertRun`, `variant 'v2'`, `intent 'log'`) so `run_id` exists; on `save` call `saveMealV2` and set `status 'saved'`, `meal_id`; update the run with tokens (incl. router), cost, `latency_ms` (request start → reply ready), steps, confidence, `outcome`, `confirmation_requested`; any thrown error → `outcome 'error'` with the message stored
- [ ] T030 [US1] In `src/app/api/chat/route.ts`, when the effective pipeline is not `v1` and the intent is `log` (and it is not a form log), call `runLogPipelineV2` and respond with `createUIMessageStream` + `createUIMessageStreamResponse`, writing a `data-meal-draft` part (when there is a draft) and a text part from `buildReply`; keep session-logger events (`promptSent`, `aiResponse`) for this path
- [ ] T031 [US1] Create the `log_meal_v2` tool in `src/lib/ai/tools/log-v2-tool.ts` (input: the user's meal text; execute runs `runLogPipelineV2` and returns `{ draft, reply }`); in `src/lib/ai/chat-turn.ts` give the `mixed` agent `log_meal_v2` instead of `log_meal` when `logPipeline` is not `v1`
- [ ] T032 [P] [US1] Create the generic `Alert` component in `src/components/ui/Alert.tsx` (`'use client'`, `$tone: 'info' | 'warning'`, icon slot, dark-mode palette consistent with `Card.tsx`)
- [ ] T033 [US1] Create `src/components/specific/MealDraftTable.tsx` (`'use client'`), read-only mode: rows grouped by dish, columns ingredient / amount (g) / source badge (estimated, stated, yours), "from history" note per dish, `Alert` with `logV2.estimatedAlert`; labels via `t(draft.language, …)` so the table matches the reply; rows with `quantity_source 'user'` show the "Tuyo"/"Yours" badge and the alert is hidden when every row is `user`; when `changes_pending` is true show `logV2.confirmChanges`; usable at phone width without horizontal page scroll
- [ ] T034 [US1] In `src/components/specific/MealLogger.tsx`, render `data-meal-draft` parts and `tool-log_meal_v2` outputs with `MealDraftTable` (typed with `PlenishUIMessage`), and extend the refresh effect so a draft with `status 'saved'` also triggers `router.refresh()`
- [ ] T035 [P] [US1] Show the estimated badge (`Alert` or a compact variant) on meals with `is_estimated = true`: add `is_estimated` to the selects in `src/actions/meals.ts` and `src/actions/calendar.ts`, render it in `src/components/specific/RecentMealsList.tsx` and the meal cell in `src/components/ui/MealWeekGrid.tsx`

**Checkpoint**: US1 works end to end with a SQL-set preference; quickstart #2 and #8 pass; v1 users unchanged.

---

## Phase 4: User Story 2 — Confirm or edit when the assistant is not sure (P2)

**Goal**: Medium-confidence meals are shown as an editable draft; the user confirms or edits by chat or in the table; auto-saved meals can be corrected.

**Independent Test**: Chat "almorcé una arepa catira" → draft; reply "sin queso" → new draft; edit a quantity in the table → Save → stored rows match, run `user_corrected = true` (quickstart #3–#5, #7).

### Implementation for User Story 2

- [ ] T036 [P] [US2] Implement the `revise` node in `src/lib/ai/log-v2/revise.ts`: one call with the current draft and the user's text returning `{ action: confirm | edit | cancel, ingredients edits }` (it is only called after the router returned `revise`); apply edits in code, mark changed/added rows `quantity_source 'user'`, `confidence_level 'high'`, `confidence_score null`; for a saved draft, `edit` sets `changes_pending: true` and never writes
- [ ] T037 [US2] Implement `confirmMealDraft` and `updateMealIngredients` in `src/actions/meal-drafts.ts` (`'use server'`) per `contracts/server-actions.md` and the server-side rules in `contracts/meal-draft.md`: validate with `MealDraft`, verify `run_id`/`meal_id` belong to the user, recompute `dish_key`/`meal_level`, re-run the `nutrition` node when rows changed, save via `saveMealV2` or replace rows, update the run (`meal_log_id`, `outcome 'saved'`, `user_corrected`), `revalidatePath('/dashboard')`
- [ ] T038 [US2] In `src/app/api/chat/route.ts`, only when the pipeline is not `v1`: find the latest `data-meal-draft` (or `tool-log_meal_v2` output) in the last assistant message, validate it, and pass `draftPending: true` to `routeMessage`. When the route is `revise`, call the `revise` node: **pending** draft — `confirm` → save, `edit` → new pending draft, `cancel` → `logV2.cancelled`; **saved** draft — `edit` → corrected table with `changes_pending: true` and `logV2.confirmChanges` (nothing written), `confirm` with `changes_pending` → `updateMealIngredients`, `confirm` without changes → short acknowledgement, `cancel` → keep the meal unchanged (AI rule 8). Any other intent drops the draft and continues normally with no extra call. Add the revise usage to the original run's `steps`, tokens and cost
- [ ] T039 [US2] Add edit mode to `src/components/specific/MealDraftTable.tsx`: editable name and grams, remove row, add row per dish, Save (pending → `confirmMealDraft`) / Save changes (saved → `updateMealIngredients`, only after the user presses it) / Cancel; editing a saved meal in the table sets `changes_pending` locally and writes nothing until Save changes; disable Save when a dish has no rows; show action errors; only the latest draft in the conversation is editable, older ones read-only
- [ ] T040 [US2] In `src/components/specific/MealLogger.tsx`, pass `isLatest` to `MealDraftTable`, keep the server-returned draft in local state after an action so the table reflects the saved version, and refresh the calendar after a successful save
- [ ] T041 [US2] Handle the low-confidence path end to end in `src/lib/ai/log-v2/pipeline.ts` and `src/lib/ai/log-v2/parse.ts`: `gate` action `ask` → no draft part, `logV2.question` with the dish name; verify the next user reply ("lleva harina, queso y jamón") is parsed with `listed_ingredients` and scores high

**Checkpoint**: quickstart #3, #4, #5, #7 pass.

---

## Phase 5: User Story 3 — Reuse what the user ate before (P3)

**Goal**: A dish logged before with v2 reuses its final ingredients and is saved without confirmation.

**Independent Test**: Confirm an edited "arepa catira", log it again → saved at once with the edited rows and the "based on what you logged on …" line (quickstart #6).

### Implementation for User Story 3

- [ ] T042 [US3] Replace the temporary implementation in `src/lib/ai/log-v2/history.ts`: for each parsed dish, query `meal_log_ingredients` by (`user_id`, `dish_key`) ordered by `created_at desc`, keep the rows of the most recent `meal_log_id`, return `{ meal_id, eaten_at, ingredients }` with `quantity_source 'history'` (stated quantities in the new message still win in `portions`)
- [ ] T043 [US3] In `src/lib/ai/log-v2/pipeline.ts`, mark matched dishes `source 'history'` (level high); when the meal is a single dish from history, load that meal's `meal_logs.nutrition` and skip the `nutrition` node; pass the earlier date to `buildReply` for `logV2.saved.fromHistory`; record `history_hits` in the history step `summary`

**Checkpoint**: quickstart #6 passes; a repeated single-dish meal makes 2 model calls (router + parse) in its run's `steps`.

---

## Phase 6: User Story 4 — Choose the pipeline and compare variants (P4)

**Goal**: Preferences page with v1/v2 for everyone and shadow mode for whitelisted developers; shadow v1 runs after the reply without writing data.

**Independent Test**: As a non-developer only v1/v2 appear; as a whitelisted developer on shadow mode one meal is saved and two runs share a `correlation_id` (quickstart #1, #9, #10, #11).

### Implementation for User Story 4

- [ ] T044 [US4] Implement `getPreferences` and `setLogPipeline` in `src/actions/preferences.ts` (`'use server'`) per `contracts/server-actions.md`: whitelist check before upsert, map the trigger's `shadow_requires_developer` error, `revalidatePath('/preferences')`
- [ ] T045 [P] [US4] Create the generic `RadioCardGroup` component in `src/components/ui/RadioCardGroup.tsx` (`'use client'`, options with label, description and optional badge, keyboard accessible, `role="radiogroup"`)
- [ ] T046 [US4] Create `src/components/specific/LogPipelinePreference.tsx` (`'use client'`): `RadioCardGroup` with v1 and v2, plus v2 + shadow v1 with the cost note only when `isDeveloper`; calls `setLogPipeline`, shows saved/error state via `t(lang, …)` with `lang` received as a prop (never fetched in the client)
- [ ] T047 [US4] Create `src/app/preferences/page.tsx` (Server Component calling `getPreferences`) and `src/app/preferences/PreferencesLayout.tsx` (mirroring `src/app/settings/SettingsLayout.tsx`), reading `users.default_language` and rendering `LogPipelinePreference` with the effective value and `lang`
- [ ] T048 [P] [US4] Add a Preferences entry (lucide `SlidersHorizontal`) next to Settings in `src/app/dashboard/DashboardLayout.tsx` and in `src/components/layout/MobileBottomNav.tsx`; label via `t(lang, 'preferences.nav')` with `lang` passed down from the Server Component that renders each layout (`users.default_language`); check the bottom nav still fits at 360 px
- [ ] T049 [US4] Implement `runShadowV1` in `src/lib/ai/shadow.ts`: build the v1 log turn with `buildChatTurn({ ..., route, saveMealLog: no-op returning a fake success })` restricted to the `log` agent, run `generateText` with the same messages and `turnLoopSettings`, write a run with `variant 'v1'`, `is_shadow true`, `outcome 'shadow'`, `intent 'log'`, the shared `correlationId`, `latency_ms` measured from shadow start; also send the shadow turn to the session logger (`createServerWriter`, context `shadow: true`); catch every error into the run's `error` column
- [ ] T050 [US4] In `src/app/api/chat/route.ts`, when the effective pipeline is `v2_shadow_v1` and the intent is `log` (not form, not `mixed`), schedule `runShadowV1` with `after()` from `next/server`; never for other intents (research R6)

**Checkpoint**: quickstart #1, #9, #10, #11 pass; shadow adds no delay to the reply.

---

## Phase 7: Polish & Cross-Cutting

- [ ] T051 [P] Create `evals/datasets/log-v2.json` with 20 common Spanish and Latin American dishes (incl. arepa catira, tortilla de patatas, entrecot, paella, pabellón criollo, cocido, gazpacho, empanadas, bandeja paisa, huevos rancheros) and the main ingredients a reviewer expects for each
- [ ] T052 Create `evals/log-v2.eval.ts`: run `runLogPipelineV2` against the dataset with `evals/lib/fake-supabase.ts` (writes stubbed), report per dish the share of expected ingredients found (SC-001 target ≥ 80%), confidence level, model calls, tokens and estimated cost; add 3 history cases where the fake Supabase returns earlier `meal_log_ingredients` rows for "arepa catira", "Tortilla de Patatas" and "una paella" and assert they are reused through `normalizeDishKey` and that a single-dish match makes no `ingredients`/`nutrition` calls (SC-003, target ≥ 90%); history returns no matches for the 20 base dishes; write results to `evals/results/` like the other evals
- [ ] T053 [P] Add `src/lib/ai/log-v2/`, `src/lib/ai/save-meal.ts`, `src/lib/ai/runs.ts`, `src/lib/ai/shadow.ts` and `src/lib/ai/tools/log-v2-tool.ts` to the Layout list in `.claude/rules/ai.md`
- [ ] T054 [P] Update `docs/product_spec.md` Meal Logging section with the v2 ingredient breakdown, confirmation flow and the Preferences page
- [ ] T055 Run every scenario in `specs/045-ai-log-v2/quickstart.md` and fix what fails
- [ ] T056 Run (scripts in `package.json`) `npm run test`, `npm run eval` (compare v1 results with `specs/045-ai-log-v2/eval-baseline.md`) and `npm run build` (zero type errors)

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (1)** → **Foundational (2)** → user stories.
- **US1 (3)** depends on Phase 2.
- **US2 (4)** depends on US1 (it edits the drafts US1 produces).
- **US3 (5)** depends on US1 (replaces the `history` stub, uses saved ingredient rows). Independent of US2. **Ships in the same PR as US1.**
- **US4 (6)** depends on Phase 2 only for the Preferences page (T044–T048) and on US1 for shadow mode (T049–T050).
- **Polish (7)** after the stories you ship.

### Within phases

- T004 before T005/T006 (docs describe the migration) — can be written together.
- T007 → T008 → T009 (baseline, change, eval gate).
- T011 → T012 (both edit `router.ts`); T012 before T038.
- T013, T014, T015 before T018; T017 before T018.
- US1: T021–T026 in parallel → T027 → T029 → T030 → T031; T032 → T033 → T034.
- US2: T036 and T037 in parallel → T038; T039 → T040.
- US4: T044 → T046 → T047; T049 → T050.

### Shared-file sequencing (not parallel)

- `src/app/api/chat/route.ts`: T018 → T030 → T038 → T050
- `src/lib/ai/router.ts`: T011 → T012
- `src/lib/ai/chat-turn.ts`: T017 → T031
- `src/lib/ai/log-v2/pipeline.ts`: T029 → T043
- `src/components/specific/MealDraftTable.tsx`: T033 → T039
- `src/components/specific/MealLogger.tsx`: T034 → T040

---

## Parallel Examples

**Phase 2**
```text
T010 MODEL_PRICES in provider.ts
T011 router usage in router.ts
T014 getEffectivePipeline in log-v2/preferences.ts
T015 types.ts + schemas.ts
T016 dish-key.ts
```

**US1**
```text
T021 parse.ts   T022 ingredients.ts   T023 portions.ts
T024 nutrition.ts   T025 gate.ts   T026 history.ts (stub)
T028 reply.ts   T032 ui/Alert.tsx   T020 unit tests
```

**US4**
```text
T045 ui/RadioCardGroup.tsx   T048 nav links
(while T044 preferences actions is written)
```

---

## Implementation Strategy

### MVP (US1 + US3, merged together)

1. Phases 1–2, apply the migration, confirm evals unchanged (T009).
2. Phase 3 (US1); set your preference to `v2` with SQL; run quickstart #2, #8 on the branch.
3. Phase 5 (US3) replaces the `history` stub — **US1 is never merged without it**, so no stub reaches `main` (constitution: no mocked data in production paths).
4. Merge US1 + US3 in one PR; check the first `ai_pipeline_runs` rows: cost and latency of v1 vs v2 on similar messages.

### Incremental delivery

1. PR 1: US1 + US3 → ingredient breakdown with history reuse (the main cost lever).
2. PR 2: US2 → confirmation and editing (the main quality lever).
3. PR 3: US4 → Preferences page and shadow comparison.
4. Polish → eval, docs, full quickstart, build (with the last PR).

Each increment keeps v1 as the default for everyone, so `main` stays safe after every merge.

---

## Notes

- One commit per task or per logical group, format `<type>(045): <area> <summary>` (see `.claude/commands/commit.md`).
- Run `npm run eval` after any prompt, tool or router change (AI rule 7).
- Order: the Preferences page is in US4 because US1–US3 can be enabled with one SQL row; US1 and US3 ship together (plan §Implementation phases).

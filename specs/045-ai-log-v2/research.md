# Research: AI Meal Logging v2

**Feature**: `045-ai-log-v2` | **Date**: 2026-10-19

Each entry: Decision · Rationale · Alternatives considered.

---

## R1. Where v2 plugs into the chat turn

**Decision**: v2 is a **code-driven pipeline** (`runLogPipelineV2`) called directly by the chat route when the router returns `log` and the user's pipeline is `v2`/`v2_shadow_v1`. The route answers with `createUIMessageStream`: a `data-meal-draft` part (the table) plus a short text part built from a template. No agent loop and no final "write a reply" model call.

For `mixed` messages under v2, the mixed agent gets a `log_meal_v2` tool that wraps the same pipeline; its output is rendered as the same table.

**Rationale**:
- The steps are known in advance (Anthropic "workflow", not "agent"), so code can sequence them. An agent loop would add one forced tool call and one reply call per meal — pure cost.
- A template reply is deterministic, translatable and free.
- Reusing one pipeline function from both entry points keeps a single implementation.

**Alternatives considered**:
- *v2 as a new tool inside the existing log agent*: +2 model calls per meal, and the model could paraphrase or drop table rows.
- *v2 as an autonomous agent choosing sources*: harder to cost, observe and compare; rejected for the base version (see spec §Context).

---

## R2. Pipeline nodes and model calls

**Decision**: Six nodes behind one interface (`PipelineNode<In, Out>` with `name` and `run(input, ctx)`), executed in order. Three call the model, three are plain code:

| # | Node | Kind | Model calls |
|---|------|------|-------------|
| 1 | `parse` | model | 1 — dishes, meal type, eaten time, language, stated quantities, user-listed ingredients |
| 2 | `history` | code | 0 — DB lookup by `dish_key` |
| 3 | `ingredients` | model | 1 per dish without history, **in parallel**; returns ingredients with standard grams + confidence score |
| 4 | `portions` | code | 0 — applies stated quantities, sets `quantity_source` |
| 5 | `nutrition` | model | 1 per meal — meal-level `NutritionSchema` (servings, food groups); no kcal/macros |
| 6 | `gate` | code | 0 — score → level → action (spec §Confidence) |

Typical "arepa catira" turn: router + parse + 1 ingredients + nutrition = **4 calls**; a repeated dish: router + parse + nutrition = **3** (nutrition is reused from history too → **2**, see R5).

**Rationale**: The spec requires swappable nodes. Splitting by responsibility lets a later task replace one node (e.g. `nutrition` → food-composition DB, `history` → embeddings, `ingredients` → + web search) without touching the others. Portion defaults are produced by the ingredients call (the model already knows "entrecôte ≈ 250 g") so a separate portion model call is not needed; the `portions` node stays as the seam for the future "exact quantities" task.

**Alternatives considered**:
- *One big structured call for everything*: cheapest (1 call) but not swappable and mixes concerns; it is effectively what v1 does, so it would not test the hypothesis.
- *A model call per node (6 calls)*: slower and more expensive with no quality gain for code-only steps.

---

## R3. Pending drafts and confirmation

**Decision**: A pending meal is a **draft object carried in the conversation**, as the `data-meal-draft` part of the assistant message. It is never stored in the database before confirmation.

- **Button "Guardar" / inline edits in the table** → Server Action `confirmMealDraft(draft)` (mutation via Server Action, constitution IV).
- **Chat reply after a draft** ("sí", "sin queso") → the **router** decides. When the last assistant message carries an actionable draft, the router prompt offers an extra intent, `revise` ("the user confirms, corrects or cancels the meal shown above"); without a draft that intent does not exist. The keyword fallback maps `sí|si|vale|ok|no|sin|con|quita|añade|cambia|yes|remove|add` to `revise` only when a draft is present. Only a `revise` route calls the **`revise` node** (1 model call), which returns `confirm | edit | cancel` plus the edited rows. Any other intent drops the draft and the message is handled normally — no extra call.
- **Pending draft**: `confirm` saves; `edit` returns a new pending draft; `cancel` drops it.
- **Saved draft** (FR-013, auto-saved or already confirmed): `edit` returns the corrected table with `status 'saved'` and `changes_pending: true` and asks "¿Guardo estos cambios?" — nothing is written. The next `confirm` (button or chat) calls `updateMealIngredients`. This follows AI rule 8: edits to stored data need explicit confirmation.

`revise` is internal to v2: it is never offered to v1 users and never stored as a v1 intent.

The draft is validated with Zod on the server and re-scoped to the authenticated user; it carries no ids the server trusts except `run_id` and `meal_id`, which are checked against the user's own rows.

**Rationale**: Matches the spec ("transient, lives in the conversation"), no new table, and drafts naturally disappear when the conversation moves on. Drafts only describe the user's own meal, so a tampered draft can only affect the user's own data, which they could edit anyway.

**Alternatives considered**:
- *`meal_log_drafts` table*: survives reloads, but adds a table, cleanup and RLS for a short-lived object.
- *AI SDK tool approval (`needsApproval`)*: fits yes/no, but not inline edits of rows.

---

## R4. Confidence score from the model

**Decision**: The `ingredients` node returns `confidence: number` (0–1) per dish, guided by the rubric copied from the spec into the prompt. The schema accepts any number and clamps to [0,1] in code (AI rule 4). Levels and thresholds live in `src/lib/ai/log-v2/config.ts` (`HIGH = 0.85`, `LOW = 0.50`).

**Rationale**: A rubric anchors the score; storing the raw value lets thresholds be tuned against confirmation/correction rates (spec SC-002).

**Alternatives considered**: token log-probabilities (not exposed uniformly by both providers); asking for a level directly (no tuning signal).

---

## R5. History lookup

**Decision**: `dish_key = normalize(dish_name)` — lower-case, NFD accent strip, collapse whitespace, drop leading articles/numbers (`un`, `una`, `el`, `la`, `a`, `an`, `the`, digits). The `parse` node returns a canonical `dish_name` without quantities ("arepa catira"), which keeps keys stable. Lookup: latest `meal_log_ingredients` rows for (`user_id`, `dish_key`), grouped by the most recent `meal_log_id`. A match reuses the ingredients. When the meal is a single dish found in history, the earlier meal's `nutrition` is reused too, so the `nutrition` node makes no model call; with several dishes it runs once over the combined rows.

**Rationale**: Simple, indexable, enough for exact repeats. Similarity search is a follow-up.

**Alternatives considered**: `pg_trgm` similarity (needs an extension and threshold tuning); pgvector (needs embeddings at write time) — both follow-ups.

---

## R6. Shadow v1

**Decision**: When the effective pipeline is `v2_shadow_v1` **and** the route intent is `log`, the route schedules v1 with `after()` (`next/server`): `buildChatTurn` with the already computed route (no second router call) and `saveMealLog` replaced by a no-op that returns a fake success — the same hook the evals use. It runs `generateText` with the same messages and writes an `ai_pipeline_runs` row with `is_shadow = true` and the shared `correlation_id`.

Shadow is **not** run for `mixed`, `manage`, `plan`, `chat` or form logs: those agents have tools that change data (delete, update, plan), and only logging is being compared.

**Rationale**: `after()` runs once the response has been sent, so it adds no delay to the user (SC-006); errors are caught and stored in the run's `error` column. Restricting to `log` is a code-enforced safety rule (AI rule 2).

**Alternatives considered**: a queue/worker (no infra for it today); running both in parallel before replying (adds latency).

---

## R7. Cost and usage accounting

**Decision**:
- A price table `MODEL_PRICES` (USD per 1M input/output tokens) lives in `src/lib/ai/provider.ts`, next to the model ids (AI rule 6). Starting values are taken from the provider pricing pages at implementation time and dated in a comment.
- Every node returns its `usage` (from `generateText`); the pipeline sums them and keeps a per-step list for `ai_pipeline_runs.steps`.
- `routeMessage` is extended to return its usage so both v1 and v2 runs include the router cost.
- v1 runs (non-shadow) are recorded from `streamText`'s `onFinish` (`totalUsage`).
- Runs are recorded only for meal-logging turns (`log`, `mixed`, form). `variant` is the user's effective pipeline (`v1`, or `v2` for a v2 user's `mixed` turn). Manage, plan and chat turns are not recorded.
- **Latency** is measured the same way for every variant: request start → full reply ready (shadow: from shadow start). v1 also stores `first_token_ms` in its agent step `summary`, because it streams and v2 does not.

**Rationale**: Comparable numbers for both variants from the same source.

**Alternatives considered**: provider billing exports (not per message); session-logger files (not persisted on Vercel).

---

## R8. Developer whitelist enforcement

**Decision**: Three layers:
1. **DB trigger** on `user_preferences` rejects `log_pipeline = 'v2_shadow_v1'` unless the user is in `developer_whitelist` (FR-017).
2. **Server Action** `setLogPipeline` checks the whitelist and returns a typed error (better message than a raw DB error).
3. **Request-time fallback**: `getEffectivePipeline()` downgrades `v2_shadow_v1` → `v2` if the user is no longer whitelisted (removal does not touch `user_preferences`).

`developer_whitelist` has RLS with a SELECT-own-row policy only; inserts are done by the team in the SQL editor.

**Rationale**: The DB is the authority; the action gives good UX; the fallback covers whitelist removal without a cascade.

---

## R9. Translations

**Decision**: The project has **no translation system** today (UI copy is hardcoded, mostly Spanish), although the constitution requires translated keys for English and Spanish. This feature adds a minimal one, scoped to its own strings: `src/lib/i18n/{es,en}.ts` dictionaries + `t(lang, key)` helper. Pages and navigation use `users.default_language`, read by the Server Component and passed down as a `lang` prop (client components never fetch it). Template replies and the draft table use `draft.language`, detected by the `parse` node from the user's message, so the table matches the reply.

Migrating existing hardcoded copy is a follow-up task.

**Rationale**: Complies with the constitution for everything this feature adds, without a site-wide i18n migration.

**Alternatives considered**: adopting `next-intl` now (new dependency and a migration of every page — too big for this feature).

---

## R10. Rendering the table in the chat

**Decision**: `MealLogger` renders, in addition to text parts, (a) `data-meal-draft` parts and (b) `tool-log_meal_v2` output parts, both with a new `MealDraftTable` component (`src/components/specific/`). Inline editing uses local state; "Guardar"/"Confirmar" calls `confirmMealDraft`, and on a saved meal "Guardar cambios" calls `updateMealIngredients`. The estimated-values alert is a new generic `Alert` component in `src/components/ui/` (none exists today), reused on meal views (FR-015).

**Rationale**: Follows the UI rule (generic pieces in `ui/`, domain table in `specific/`). Only the latest draft in the conversation is editable; older ones render read-only.

---

## R11. Testing

**Decision**:
- **Unit (vitest)**: `normalizeDishKey`, `gate` (levels/actions), `portions`, cost calculation, draft schema validation.
- **Evals** (`evals/`): a new `log-v2.eval.ts` with a small dish dataset (20 dishes, SC-001) using the existing fake Supabase; full eval set is a follow-up.
- **Manual**: quickstart.md scenarios.
- **Gate**: `npm run build` with zero type errors; `npm run eval` before/after to confirm v1 is unchanged (SC-007).

---

## R12. No kcal or macronutrients in this feature

**Decision**: v2 stores ingredients and grams only. Energy and macronutrients are left to the food-composition follow-up, which calculates them from `quantity_g`.

**Rationale**: No current feature reads calories (targets in `user_diet_profiles` are serving-based); a calorie target needs body data and a goal the app does not collect; a model estimate of kcal on an estimated portion of a guessed recipe compounds errors and would look more precise than it is. Grams are the durable data — kcal/macros derived from them later are more accurate and apply retroactively to every stored v2 meal. Side benefits: fewer output tokens per meal and a narrower table on mobile.

**Alternatives considered**: model-estimated kcal/macros per ingredient (the earlier draft of this plan) — rejected for the reasons above; kcal only — same accuracy problem.

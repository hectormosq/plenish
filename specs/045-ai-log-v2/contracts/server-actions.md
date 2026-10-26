# Contract: Server Actions and server helpers

All mutations are Server Actions in `src/actions/` (constitution IV). Each one calls `supabase.auth.getUser()` first and never accepts a user id.

## `src/actions/preferences.ts` (new)

```ts
export type LogPipeline = 'v1' | 'v2' | 'v2_shadow_v1';

export async function getPreferences(): Promise<{
  logPipeline: LogPipeline;      // stored value (v1 if no row)
  effectivePipeline: 'v1' | 'v2' | 'v2_shadow_v1'; // after whitelist downgrade
  isDeveloper: boolean;
}>;

export async function setLogPipeline(value: LogPipeline):
  Promise<{ ok: true } | { ok: false; error: 'unauthorized' | 'shadow_requires_developer' | 'invalid' }>;
```

- `setLogPipeline` upserts `user_preferences`. It checks the whitelist first; the DB trigger is the final guard (its `P0001 shadow_requires_developer` is mapped to the same error).
- `revalidatePath('/preferences')`.

## `src/lib/ai/log-v2/preferences.ts` (server-only helper)

```ts
export async function getEffectivePipeline(supabase, userId): Promise<'v1' | 'v2' | 'v2_shadow_v1'>;
```

Two parallel selects (`user_preferences`, `developer_whitelist`). `v2_shadow_v1` without whitelist → `v2`. Called once per chat request.

## `src/actions/meal-drafts.ts` (new)

```ts
export async function confirmMealDraft(draft: unknown):
  Promise<{ ok: true; mealId: string; draft: MealDraft } | { ok: false; error: 'unauthorized' | 'invalid' | 'not_found' | 'already_saved' | 'db' }>;

export async function updateMealIngredients(draft: unknown):
  Promise<{ ok: true; draft: MealDraft } | { ok: false; error: 'unauthorized' | 'invalid' | 'not_found' | 'db' }>;
```

- Both parse `draft` with `MealDraft` (contracts/meal-draft.md) and apply its server-side rules.
- `confirmMealDraft` → `saveMealV2(draft)`; sets the run's `meal_log_id`, `outcome = 'saved'`, and `user_corrected = true` if any row changed since the pipeline output.
- `updateMealIngredients` → replaces the meal's `meal_log_ingredients` rows, re-runs the `nutrition` node to rewrite `meal_logs.nutrition`, rewrites `inferred_ingredients`, sets the run's `user_corrected = true`.
- Both `revalidatePath('/dashboard')`.

## `src/lib/ai/log-v2/save.ts` (server-only)

```ts
export async function saveMealV2(supabase, userId, draft: MealDraft, runId: string):
  Promise<{ ok: true; mealId: string } | { ok: false; error: string }>;
```

Reuses the existing `saveMealLogToDb` path for the `meal_logs` insert, household/co-eater resolution and planned-meal override (extracted from `meal-tools.ts` into `src/lib/ai/save-meal.ts` so both pipelines share it), then inserts `meal_log_ingredients` with `log_pipeline = 'v2'`, `is_estimated = true`.

## Chat route changes (`src/app/api/chat/route.ts`)

Request body: unchanged (`messages`, `tzOffset`, `sessionId`, `logContext`).

Per request:
1. Auth → `getEffectivePipeline`.
2. `correlationId = crypto.randomUUID()`.
3. Form log (meal type picked in the input) → no router. pipeline = v1: v1 form agent (unchanged). pipeline ≠ v1: `runLogPipelineV2` with `logContext`. Either way the run is recorded with `intent 'form'`.
4. `routeMessage(model, text, previous, { draftPending })` (now also returns `usage`). `draftPending` is true only when pipeline ≠ v1 and the last assistant message has an actionable `data-meal-draft` / `tool-log_meal_v2` output; then the router may return `revise`.
5. intent = `revise` → `revise` node → `confirm` (pending: save; saved with `changes_pending`: `updateMealIngredients`) / `edit` (new draft; for a saved meal `changes_pending: true` + `logV2.confirmChanges`) / `cancel`. Usage is added to the original run.
6. pipeline = v1 → existing `buildChatTurn(..., route)` + `streamText`; for `log` / `mixed`, `onFinish` writes an `ai_pipeline_runs` row (`variant = 'v1'`). Other intents write no run.
7. pipeline ≠ v1 and intent = `log` → `runLogPipelineV2` → `createUIMessageStream` writing `data-meal-draft` + text.
8. pipeline ≠ v1 and intent = `mixed` → mixed agent with `log_meal_v2` in place of `log_meal`.
9. pipeline = `v2_shadow_v1` and intent = `log` → `after(() => runShadowV1(...))`.

Any intent other than `revise` while a draft is present simply drops the draft (no extra model call).

`buildChatTurn` gains an optional `route?: RouteDecision` input (skips the router when given) and an optional `logPipeline` input (selects `log_meal` vs `log_meal_v2` for `mixed`). Evals keep calling it as today.

# Data Model: AI Meal Logging v2

**Feature**: `045-ai-log-v2` | **Date**: 2026-10-19
**Migration**: `supabase/migrations/00010_ai_log_v2.sql` (one file; next number after `00009`)
**Docs**: `docs/database_schema.md` and the "Tables in use" list in `.claude/rules/database.md` are updated in the same change.

---

## Entity overview

```text
public.users ──1:0..1── developer_whitelist
public.users ──1:0..1── user_preferences
public.users ──1:N───── meal_logs ──1:N── meal_log_ingredients
public.users ──1:N───── ai_pipeline_runs ──N:0..1── meal_logs
```

---

## 1. `developer_whitelist` (new)

| Column | Type | Constraints |
|--------|------|-------------|
| `user_id` | uuid | PK, FK → `public.users(id)` ON DELETE CASCADE |
| `note` | text | nullable |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |

**RLS**
- `developer_whitelist: select own` — SELECT USING (`user_id = auth.uid()`).
- No INSERT/UPDATE/DELETE policies → only the SQL editor / service role can change rows.

**Helper**: `public.is_developer(uid uuid) returns boolean` — `SECURITY DEFINER`, `STABLE`, `SET search_path = public`; used by the trigger below.

---

## 2. `user_preferences` (new)

| Column | Type | Constraints |
|--------|------|-------------|
| `user_id` | uuid | PK, FK → `public.users(id)` ON DELETE CASCADE |
| `log_pipeline` | text | NOT NULL DEFAULT `'v1'`, CHECK IN (`'v1'`, `'v2'`, `'v2_shadow_v1'`) |
| `updated_at` | timestamptz | NOT NULL DEFAULT now() |

**RLS**
- `user_preferences: select own` — SELECT USING (`user_id = auth.uid()`).
- `user_preferences: insert own` — INSERT WITH CHECK (`user_id = auth.uid()`).
- `user_preferences: update own` — UPDATE USING/WITH CHECK (`user_id = auth.uid()`).

**Trigger** `user_preferences_guard` (BEFORE INSERT OR UPDATE):
- If `NEW.log_pipeline = 'v2_shadow_v1'` and `NOT is_developer(NEW.user_id)` → `RAISE EXCEPTION 'shadow_requires_developer'` (errcode `P0001`).
- Sets `NEW.updated_at = now()`.

**Rules**: no row = `v1`. Rows are upserted on first save. Whitelist removal does not modify this table; the app downgrades at read time (see `getEffectivePipeline`).

---

## 3. `meal_log_ingredients` (new)

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK DEFAULT `gen_random_uuid()` |
| `meal_log_id` | uuid | NOT NULL, FK → `public.meal_logs(id)` ON DELETE CASCADE |
| `user_id` | uuid | NOT NULL, FK → `public.users(id)` ON DELETE CASCADE |
| `dish_name` | text | NOT NULL, 1–120 chars |
| `dish_key` | text | NOT NULL |
| `position` | smallint | NOT NULL, ≥ 0 |
| `name` | text | NOT NULL, 1–120 chars |
| `quantity_g` | numeric(7,1) | NOT NULL, > 0 |
| `quantity_source` | text | NOT NULL, CHECK IN (`'stated'`, `'estimated'`, `'history'`, `'user'`) |
| `confidence_score` | numeric(3,2) | nullable, 0–1 |
| `confidence_level` | text | NOT NULL, CHECK IN (`'high'`, `'medium'`, `'low'`) |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |

**Indexes**
- `meal_log_ingredients_meal_idx` on (`meal_log_id`, `position`)
- `meal_log_ingredients_history_idx` on (`user_id`, `dish_key`, `created_at DESC`)

**RLS**
- `meal_log_ingredients: select visible meal` — SELECT USING (`EXISTS (SELECT 1 FROM public.meal_logs ml WHERE ml.id = meal_log_id)`). The subquery runs under the `meal_logs` policy ("select own or shared"), so ingredient visibility follows meal visibility, including co-eaters.
- `meal_log_ingredients: insert own` — INSERT WITH CHECK (`user_id = auth.uid()` AND the meal belongs to `auth.uid()`).
- `meal_log_ingredients: update own` / `delete own` — USING (`user_id = auth.uid()`).

**Rules**
- `user_id` always equals the meal's `user_id` (set by the server, never from the client).
- Editing a meal's ingredients = delete its rows + insert the new set, in one RPC-free sequence inside the Server Action (rows are few; ordering is by `position`).
- `quantity_source` transitions: `estimated|stated|history` → `user` when the user edits that row's quantity or name. New rows added by the user are `user`.
- `confidence_level` for `user` rows is `high`; `confidence_score` is null.
- No kcal/macro columns: they will be added by the food-composition follow-up and calculated from `quantity_g` (also for rows stored before it).

---

## 4. `ai_pipeline_runs` (new)

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK DEFAULT `gen_random_uuid()` |
| `user_id` | uuid | NOT NULL, FK → `public.users(id)` ON DELETE CASCADE |
| `correlation_id` | uuid | NOT NULL |
| `variant` | text | NOT NULL, CHECK IN (`'v1'`, `'v2'`) |
| `is_shadow` | boolean | NOT NULL DEFAULT false |
| `intent` | text | nullable — `log`, `mixed` or `form`; runs are only recorded for meal-logging turns |
| `meal_log_id` | uuid | nullable, FK → `public.meal_logs(id)` ON DELETE SET NULL |
| `model` | text | nullable |
| `input_tokens` | integer | nullable |
| `output_tokens` | integer | nullable |
| `est_cost_usd` | numeric(10,6) | nullable |
| `latency_ms` | integer | nullable — request start → full reply ready, for every variant (shadow: from shadow start); v1 also stores `first_token_ms` in its agent step `summary` |
| `steps` | jsonb | NOT NULL DEFAULT `'[]'` — `[{ name, input_tokens, output_tokens, latency_ms, summary }]` |
| `confidence_score` | numeric(3,2) | nullable |
| `confidence_level` | text | nullable, CHECK IN (`'high'`, `'medium'`, `'low'`) |
| `outcome` | text | nullable, CHECK IN (`'saved'`, `'draft'`, `'question'`, `'error'`, `'shadow'`) |
| `confirmation_requested` | boolean | NOT NULL DEFAULT false |
| `user_corrected` | boolean | NOT NULL DEFAULT false |
| `error` | text | nullable |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |

> `intent` and `outcome` are additions beyond the spec table: `intent` lets v1 and v2 runs be filtered to `log` turns only, and `outcome` records the gate decision without parsing `steps`. Both are reflected back into `spec.md` §Data Changes.

**Indexes**
- `ai_pipeline_runs_correlation_idx` on (`correlation_id`)
- `ai_pipeline_runs_user_idx` on (`user_id`, `created_at DESC`)

**RLS**
- `ai_pipeline_runs: select own` — SELECT USING (`user_id = auth.uid()`).
- `ai_pipeline_runs: insert own` — INSERT WITH CHECK (`user_id = auth.uid()`).
- `ai_pipeline_runs: update own` — UPDATE USING (`user_id = auth.uid()`) — used to set `meal_log_id` on confirmation and `user_corrected` on edit.

**Rules**
- One row per pipeline execution. A v2 run that ends in a draft is later updated (not duplicated) when the draft is confirmed (`meal_log_id`, `outcome = 'saved'`) or edited (`user_corrected = true`).
- A `revise` call (chat reply to a draft) adds its usage to the same run's `steps`, so the run cost includes the confirmation turn.
- Shadow rows: `is_shadow = true`, `variant = 'v1'`, `outcome = 'shadow'`, `meal_log_id` null.

---

## 5. `meal_logs` (changed)

| Column | Type | Constraints |
|--------|------|-------------|
| `log_pipeline` | text | nullable, CHECK IN (`'v1'`, `'v2'`) |
| `is_estimated` | boolean | NOT NULL DEFAULT false |

- v1 chat logs: `log_pipeline = 'v1'`, `is_estimated = false`. Form logs and older rows: `null` / `false`.
- v2 logs: `log_pipeline = 'v2'`, `is_estimated = true`; `nutrition` (meal-level, from the `nutrition` node) and `inferred_ingredients` (`"<name> (<g> g)"` strings built from the rows) are also written so existing readers keep working.
- No backfill.

---

## 6. Transient: `MealDraft` (not stored)

Carried in the assistant message as a `data-meal-draft` UI part; validated with Zod on every server use. Full schema in [contracts/meal-draft.md](contracts/meal-draft.md).

**States**

```text
            ┌────────── gate: high ──────────┐
 message ──▶ pipeline ──▶ gate: medium ──▶ DRAFT ──confirm──▶ SAVED
                      └─▶ gate: low ──▶ QUESTION (no draft)
                                        DRAFT ──edit──▶ DRAFT
                                        DRAFT ──cancel / other intent──▶ DROPPED

 SAVED ──edit──▶ SAVED + CHANGES PENDING ──confirm──▶ SAVED (user_corrected)
                         └──cancel / other intent──▶ SAVED (unchanged)
```

Transitions are triggered by the `revise` route (chat) or the table buttons (Server Actions). A saved meal is only rewritten on an explicit confirm (AI rule 8).

Only the most recent draft in a conversation is actionable; earlier ones render read-only.

---

## 7. Migration outline (`00010_ai_log_v2.sql`)

1. `CREATE TABLE developer_whitelist` + RLS + policy.
2. `CREATE FUNCTION is_developer(uuid)`.
3. `CREATE TABLE user_preferences` + RLS + policies + guard trigger function and trigger.
4. `ALTER TABLE meal_logs ADD COLUMN log_pipeline …, ADD COLUMN is_estimated …`.
5. `CREATE TABLE meal_log_ingredients` + indexes + RLS + policies.
6. `CREATE TABLE ai_pipeline_runs` + indexes + RLS + policies.
7. Comment: how to whitelist a developer — `INSERT INTO public.developer_whitelist (user_id, note) SELECT id, 'reason' FROM public.users WHERE email = '…';`

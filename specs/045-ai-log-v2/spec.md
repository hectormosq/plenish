# Feature Specification: AI Meal Logging v2 — Ingredient Inference

**Feature Branch**: `045-ai-log-v2`
**Created**: 2026-10-19
**Status**: Draft
**Input**: User description: "AI meal logging v2, built beside the current v1 pipeline. From a vague chat message (e.g. 'arepa catira', 'I ate an entrecôte'), split it into dishes, reuse ingredients from the user's past meals when the same dish was logged before, otherwise let the model infer the ingredients with a confidence score. Portions use standard values (entrecôte = 250 g). All values are flagged as estimated with a visible alert. The agent replies with a summary table: if confidence is high it saves and confirms; otherwise it asks the user to confirm, or edit via chat or directly in the table. Ingredients are stored per meal. Each step is a separate, simple, swappable node. A per-user preference selects v1, v2, or v2 + shadow v1 (developer tool). Telemetry tags every run with its variant."

## Context

Today a chat message that reports a meal is saved in one step: the assistant guesses a free-text list of ingredients and coarse nutrition data, never asks for confirmation, and never looks at what the user ate before. Logging v2 turns a vague description into an ingredient-level record (ingredient and estimated quantity in grams) so later features — nutrition analysis, habit tracking, better recommendations and planning — have detailed data to work with.

Energy (kcal) and macronutrients are deliberately **not** estimated in this feature: no current feature uses them (the app's targets are serving-based), model estimates on estimated portions would be imprecise, and they can be calculated later from the stored grams with a food-composition database — for every meal already stored, not only new ones.

v1 stays in place. Both pipelines run side by side so the team can compare quality, cost and observability before deciding which one to keep.

The v2 flow is a fixed sequence of independent steps: **dish detection → history lookup → ingredient inference → portion estimation → nutrition estimation → confidence gate → save or confirm**. Each step starts with the simplest viable behaviour and can be replaced later without changing the others.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Log a vague dish and get an ingredient breakdown (Priority: P1)

A user on v2 writes "almorcé una arepa catira" in the chat. The assistant recognises a meal report, works out the ingredients (corn flour, salt, butter, shredded chicken cooked with onion, pepper and spices, shredded cheese) with standard quantities. When it is confident, it saves the meal and replies with a summary table of what was recorded, marked as estimated.

**Why this priority**: This is the core value — turning a vague description into a detailed nutrition record with no extra effort from the user.

**Independent Test**: With the preference set to v2, send a message naming a well-known dish and check that the meal is saved with its ingredient rows and that the reply shows the summary table and the estimated-values alert.

**Acceptance Scenarios**:

1. **Given** a user on v2, **When** they write "almorcé una arepa catira", **Then** a lunch meal is saved with one row per ingredient (name, quantity in grams, stated or estimated) and the reply shows a summary table of those rows grouped by dish.
2. **Given** a user on v2, **When** they write "I ate an entrecôte", **Then** the entrecôte is recorded with a standard portion (about 250 g) and the reply states that the quantities are estimated.
3. **Given** a user on v2, **When** they write "300 g de entrecot con ensalada", **Then** the entrecôte keeps the stated 300 g, the salad gets a standard portion, and each row shows whether its quantity was stated or estimated.
4. **Given** a saved v2 meal, **When** the user views it anywhere in the app, **Then** an alert indicates that its quantities are estimates (unless every row is the user's own value).

---

### User Story 2 - Confirm or edit when the assistant is not sure (Priority: P2)

A user writes the name of an unusual or ambiguous dish. The assistant shows the same summary table but does not save yet; it asks the user to confirm, or to correct the ingredients either by replying in the chat ("sin queso, y con aguacate") or by editing the table directly. On confirmation the meal is saved with the final values.

**Why this priority**: Keeps the user in control when the inference is uncertain, which protects the quality of the stored data.

**Independent Test**: Send a dish name that yields a non-high confidence, edit one ingredient in the table, confirm, and check that the stored rows match the edited table.

**Acceptance Scenarios**:

1. **Given** an inference with medium or low confidence, **When** the assistant replies, **Then** nothing is saved and the reply contains the summary table plus a request to confirm or edit.
2. **Given** a pending confirmation, **When** the user replies "sí" / "yes", **Then** the meal is saved exactly as shown.
3. **Given** a pending confirmation, **When** the user replies with a correction in the chat, **Then** the assistant shows an updated table and asks again (or saves, if the user said to save).
4. **Given** a pending confirmation, **When** the user changes a quantity, removes a row or adds an ingredient directly in the table and confirms, **Then** the meal is saved with the edited values; the edited rows are marked as user-provided.
5. **Given** a meal that was saved automatically (high confidence), **When** the user corrects it from the confirmation message, **Then** the assistant shows the corrected table and asks to save the changes; the stored ingredients are updated only after the user confirms.
6. **Given** low confidence because the dish is unknown, **When** the assistant replies, **Then** it asks an open question about what the dish contains instead of showing a guessed table.

---

### User Story 3 - Reuse what the user ate before (Priority: P3)

A user who logged "arepa catira" last week logs it again. The assistant finds the earlier meal, reuses its ingredients (including any corrections the user made then), treats the result as high confidence, and saves it.

**Why this priority**: Repeated meals are common; reusing confirmed data is cheaper, faster and more accurate than inferring again, and it records that the user repeats this dish.

**Independent Test**: Log and confirm a dish with an edited ingredient list, log the same dish name again, and check that the new meal copies the edited list without asking for confirmation.

**Acceptance Scenarios**:

1. **Given** a previous v2 meal with the same dish, **When** the user logs it again, **Then** the new meal uses the previous ingredients and the reply mentions that it was based on an earlier meal.
2. **Given** no earlier v2 meal with that dish, **When** the user logs it, **Then** ingredients are inferred as in Story 1.

---

### User Story 4 - Choose the logging pipeline and compare variants (Priority: P4)

On a new Preferences page, any user can choose how chat meal logging works: **v1** (current behaviour) or **v2**. Developer accounts also see **v2 + shadow v1**. In shadow mode, v2 handles the message as usual and v1 also runs in the background on the same message without saving anything, so both can be compared. Every run records which variant produced it, together with its cost and timing.

**Why this priority**: Enables the comparison that motivates the feature, but the logging experience itself (Stories 1–3) is useful without it.

**Independent Test**: Switch between the three options, log a meal under each, and check the telemetry records: one run per message for v1 and v2, two runs (one marked shadow) for v2 + shadow v1, and only one saved meal in every case.

**Acceptance Scenarios**:

1. **Given** a new or existing user, **When** they have not changed the preference, **Then** chat logging uses v1.
2. **Given** a user who is not on the developer whitelist, **When** they open Preferences, **Then** they can choose v1 or v2 only; the shadow option is not shown, and an attempt to save it anyway is rejected.
3. **Given** a whitelisted developer on shadow mode, **When** the team removes them from the whitelist, **Then** their next message is handled by v2 alone.
4. **Given** a developer on v2 + shadow v1, **When** they log a meal, **Then** exactly one meal is saved (by v2), and telemetry contains a v2 run and a shadow v1 run for the same message.
5. **Given** the shadow run fails or is slow, **When** the user logs a meal, **Then** the user's reply and saved meal are unaffected.
6. **Given** any run, **When** it finishes, **Then** its telemetry includes the variant, step-by-step model usage, estimated cost, latency, confidence level, whether confirmation was requested and whether the user corrected the result.

---

### Edge Cases

- **Several dishes in one message** ("arepa catira y jugo de parchita"): each dish is resolved separately and shown as its own group in the same table; they are saved as one meal.
- **Message mixes a meal report with another request**: the meal part follows the v2 flow; the other request is handled as it is today.
- **Drinks only** ("un café con leche"): handled like any dish.
- **The user ignores a pending confirmation** and changes subject: nothing is saved; the pending meal is dropped.
- **The user removes every ingredient** in the table: the meal cannot be confirmed until at least one ingredient remains, or the user cancels.
- **Inference produces no usable result** (model error): the user gets a clear message and can retry; no partial meal is saved.
- **Shared household meals**: a v2 meal shared with co-eaters behaves as shared meals do today; the ingredient breakdown belongs to the meal record.
- **Meals logged before v2** or by v1: they keep showing as today, with no ingredient table and no alert.
- **Language**: the table, alert and assistant replies follow the user's language (Spanish or English); ingredient names are stored as the assistant presented them.

## Requirements *(mandatory)*

### Functional Requirements

**Pipeline and steps**

- **FR-001**: The system MUST keep the current chat logging behaviour (v1) unchanged and available.
- **FR-002**: The system MUST provide a v2 chat logging flow made of separate steps — dish detection, history lookup, ingredient inference, portion estimation, nutrition estimation, confidence gate — each replaceable without changing the others.
- **FR-003**: Dish detection MUST split a message into one or more dishes.
- **FR-004**: History lookup MUST look for an earlier v2 meal of the same user containing the same dish (by name) and, if found, reuse its final ingredient list.
- **FR-005**: Ingredient inference MUST produce, for each dish without a history match, a list of ingredients and a confidence score from 0 to 1, which is turned into a level (high, medium, low) using the rules in [Confidence Levels & Thresholds](#confidence-levels--thresholds).
- **FR-006**: Portion estimation MUST assign a standard quantity in grams to each ingredient unless the user stated one, and MUST record whether each quantity was stated, estimated or reused from history.
- **FR-007**: Nutrition estimation MUST produce the meal-level nutrition data used by existing features (food groups, protein type, servings, occasional-food flag) from the resolved ingredients and quantities. It MUST NOT estimate energy (kcal) or macronutrients.

**Confirmation and saving**

- **FR-008**: When overall confidence is high, the system MUST save the meal and reply with a confirmation that includes the summary table.
- **FR-009**: When overall confidence is medium, the system MUST NOT save; it MUST reply with the summary table and ask the user to confirm or edit.
- **FR-010**: When overall confidence is low, the system MUST NOT save and MUST ask the user an open question about the dish.
- **FR-011**: The summary table MUST show the ingredients grouped by dish, with per ingredient: name, quantity (g) and whether the quantity is stated or estimated.
- **FR-012**: Users MUST be able to edit a pending meal both by replying in the chat and directly in the summary table (change quantity, remove a row, add a row, rename an ingredient), then confirm.
- **FR-013**: Users MUST be able to correct the ingredients of an automatically saved v2 meal from its confirmation message; the stored meal changes only after the user confirms the corrected table.
- **FR-014**: The system MUST store each ingredient of a v2 meal as its own record linked to the meal, with dish name, quantity in grams, quantity source (stated, estimated, history, user), dish source (history, model, user), confidence and position. No energy or macronutrient values are stored (see Context).
- **FR-015**: Every v2 meal MUST display an alert stating that its quantities are estimates while at least one of its rows is estimated. Rows the user edited or added are labelled as the user's own value ("Tuyo" / "Yours"), not as estimated.

**Preference and comparison**

- **FR-016**: The system MUST provide a dedicated **Preferences** page, separate from Settings and reachable from the main navigation, where users choose the chat logging pipeline: v1, v2, or v2 + shadow v1. The default is v1. The choice is stored per user in the database and applies on every device.
- **FR-017**: Every user MUST be able to choose between v1 and v2. The v2 + shadow v1 option MUST be visible and selectable only for accounts listed in the developer whitelist stored in the database, presented as a developer tool with a note that it costs more. The database MUST reject saving the shadow option for an account that is not on the whitelist. If an account is removed from the whitelist while on shadow mode, it MUST fall back to v2.
- **FR-017a**: Only the team can add or remove accounts from the developer whitelist. Users MUST NOT be able to modify it; a user can only read whether their own account is on it.
- **FR-018**: In shadow mode, v1 MUST run on the same message when the message is a meal report (`log` intent), without saving or changing any data and without affecting the user's reply or response time. Other intents are not shadowed, because their agents can change or delete data.
- **FR-019**: Every run (v1, v2, shadow v1) MUST be stored in the database with: variant, shadow flag, a shared identifier linking runs on the same message, per-step model usage (tokens), estimated cost, latency, confidence score and level, whether confirmation was requested, whether the user corrected the result, and the resulting meal (if any). Runs MUST also keep being sent to the existing session logger.
- **FR-020**: All new user-facing text (table headers, alert, Preferences option, assistant replies) MUST be available in Spanish and English.

**Scope**

- **FR-021**: The meal logging form (non-chat) is out of scope and keeps its current behaviour.

### Key Entities

- **Meal log** (existing): a meal the user ate. Gains a marker of the pipeline that created it and whether its values are estimated.
- **Meal ingredient** (new): one ingredient of a v2 meal — dish it belongs to, ingredient name, quantity in grams, quantity source (stated, estimated, history, user edit), confidence, position in the table.
- **Pending meal** (transient): a v2 meal waiting for user confirmation; lives in the conversation, is never stored as a meal until confirmed.
- **User preferences** (new): per-user choices shown on the Preferences page; starts with the logging pipeline.
- **Developer whitelist** (new): accounts allowed to use developer tools such as shadow mode.
- **Pipeline run** (new): one execution of a pipeline on one message — variant, shadow flag, step usage, cost, latency, outcome.

## Confidence Levels & Thresholds

Model-reported confidence is not reliable on its own, so levels combine a score with hard signals. Thresholds are configuration values, tuned later with the stored run data.

**1. Score per dish (0–1).** The model scores each dish against this rubric:

| Score | Meaning | Example |
|-------|---------|---------|
| 0.90–1.00 | Well-known dish with a standard recipe; the user's description matches it | "tortilla de patatas", "entrecot" |
| 0.70–0.89 | Known dish with common regional or household variations | "arepa catira", "paella" |
| 0.40–0.69 | Generic or ambiguous description; several different dishes fit | "un bocadillo", "pasta" |
| 0.00–0.39 | Unknown or unrecognisable dish | an invented or very local name |

**2. Level per dish.**

| Level | Rule |
|-------|------|
| High | score ≥ 0.85, **or** the dish was resolved from the user's history, **or** the user listed the ingredients themselves |
| Medium | 0.50 ≤ score < 0.85 |
| Low | score < 0.50 |

**3. Level per meal** = the lowest level among its dishes. A meal with one high and one medium dish is medium.

**4. Action.**

| Meal level | Action |
|------------|--------|
| High | Save, then reply with the summary table (FR-008) |
| Medium | Show the summary table, ask to confirm or edit; nothing saved (FR-009) |
| Low | Ask an open question about the dish; no table, nothing saved (FR-010) |

With this rubric "arepa catira" (≈ 0.80) starts as medium: the first time, the user confirms; later it comes from history and is high. The raw score is stored with each ingredient and run so the 0.85 / 0.50 thresholds can be tuned against confirmation and correction rates.

## Data Changes

All changes follow the project rules: one migration file in `supabase/migrations/`, RLS enabled with policies in the same migration, and `docs/database_schema.md` updated in the same change.

**New table `developer_whitelist`**
| Column | Type | Notes |
|--------|------|-------|
| `user_id` | uuid PK | references `public.users`, on delete cascade |
| `note` | text, nullable | why the account was added |
| `created_at` | timestamptz | default now() |

RLS: a user can SELECT only their own row. No INSERT/UPDATE/DELETE policies, so only the team (SQL editor / service role) can change it.

**New table `user_preferences`**
| Column | Type | Notes |
|--------|------|-------|
| `user_id` | uuid PK | references `public.users`, on delete cascade |
| `log_pipeline` | text, not null, default `'v1'` | check: `'v1'`, `'v2'`, `'v2_shadow_v1'` |
| `updated_at` | timestamptz | default now() |

RLS: a user can SELECT, INSERT and UPDATE only their own row. A trigger rejects `log_pipeline = 'v2_shadow_v1'` when the user is not in `developer_whitelist`. Rows are created on first save; a missing row means v1.

**New table `meal_log_ingredients`**
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `meal_log_id` | uuid, not null | references `public.meal_logs`, on delete cascade |
| `user_id` | uuid, not null | owner (same as the meal's), used by RLS and history lookup |
| `dish_name` | text, not null | as shown to the user, e.g. "Arepa catira" |
| `dish_key` | text, not null | lower-case, accent-free dish name used for history lookup |
| `position` | smallint, not null | order in the summary table |
| `name` | text, not null | ingredient name |
| `quantity_g` | numeric(7,1), not null | grams |
| `quantity_source` | text, not null | check: `'stated'`, `'estimated'`, `'history'`, `'user'` |
| `confidence_score` | numeric(3,2), nullable | model score for the dish (null when from history or user) |
| `confidence_level` | text, not null | check: `'high'`, `'medium'`, `'low'` |
| `created_at` | timestamptz | default now() |

Index on (`user_id`, `dish_key`, `created_at desc`) for history lookup. RLS: the owner can SELECT, INSERT, UPDATE, DELETE; co-eaters of a shared meal (via `meal_participants`) can SELECT, matching how shared meals work today.

**New table `ai_pipeline_runs`**
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid, not null | references `public.users` |
| `correlation_id` | uuid, not null | same value for the v2 run and its shadow v1 run on one message |
| `variant` | text, not null | check: `'v1'`, `'v2'` |
| `is_shadow` | boolean, not null, default false | |
| `intent` | text, nullable | router intent, so comparisons can be limited to `log` turns |
| `meal_log_id` | uuid, nullable | meal saved by this run; on delete set null |
| `model` | text | provider/model id |
| `input_tokens`, `output_tokens` | integer | totals for the run |
| `est_cost_usd` | numeric(10,6) | from token counts and model price |
| `latency_ms` | integer | |
| `steps` | jsonb | per step: name, tokens, latency, output summary |
| `confidence_score` | numeric(3,2), nullable | meal-level (lowest dish) score |
| `confidence_level` | text, nullable | `'high'`, `'medium'`, `'low'` |
| `outcome` | text, nullable | `'saved'`, `'draft'`, `'question'`, `'error'`, `'shadow'` |
| `confirmation_requested` | boolean | |
| `user_corrected` | boolean, default false | set when the user edits the result |
| `error` | text, nullable | |
| `created_at` | timestamptz | default now() |

Index on (`correlation_id`) and (`user_id`, `created_at desc`). RLS: a user can SELECT their own runs; rows are written by the server on the user's behalf (INSERT and UPDATE of own rows).

**Changed table `meal_logs`**
| Column | Type | Notes |
|--------|------|-------|
| `log_pipeline` | text, nullable | `'v1'` or `'v2'`; null for meals logged before this feature or through the form |
| `is_estimated` | boolean, not null, default false | true for v2 meals; drives the estimated-values alert |

**Unchanged**: `meal_logs.inferred_ingredients` and `meal_logs.nutrition` keep being written by v1 and also filled by v2 (from the ingredient rows), so existing views, recommendations and analytics keep working with either variant.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a reference set of 20 common Spanish and Latin American dishes, the v2 breakdown includes at least 80% of the main ingredients a reviewer expects for each dish.
- **SC-002**: At least 70% of messages reporting common dishes are saved without asking the user for confirmation (high confidence or history match).
- **SC-003**: When a user logs a dish they have logged with v2 before, the earlier ingredients are reused in at least 90% of cases.
- **SC-004**: A user can correct one ingredient in the table and confirm in under 30 seconds.
- **SC-005**: 100% of v1, v2 and shadow runs produce a telemetry record that allows comparing cost and latency per variant for the same message.
- **SC-006**: Shadow runs cause zero user-visible errors and add no noticeable delay to the user's reply.
- **SC-007**: Users who stay on v1 see no change in behaviour; the existing logging evals keep passing.

## Variant Decision & Retirement

Required by Constitution §V (experimental variants).

- **Comparison data**: shadow-mode runs, where v1 and v2 process the same messages, plus the eval set.
- **Decision criteria**, compared per meal:
  1. Quality: share of expected ingredients captured (SC-001) and user correction rate.
  2. Cost: average estimated cost per logged meal.
  3. Latency: average time until the user gets a reply.
  4. Friction: share of meals that needed a confirmation.
- **Decision rule**: keep v2 if it meets SC-001 and its cost per meal stays within a budget the team agrees on after the first comparison data arrives; otherwise keep v1 and record why.
- **Retirement**: once decided, the losing variant, the shadow option and the pipeline preference are removed in a dedicated follow-up task. Meals already stored by either variant stay readable.

## Assumptions

- Standard portions come from the model's general knowledge (e.g. entrecôte ≈ 250 g, arepa ≈ 120 g); a food-composition database is a later improvement.
- "Same dish" in history lookup means a simple, case- and accent-insensitive name match; similarity search is a later improvement.
- Confidence thresholds start at 0.85 (high) and 0.50 (low) and are tuned with the stored run data.
- The existing preferences (share default, chat panel side and default open) stay on the Settings page and in their current storage (Supabase Auth user metadata). Moving them to the Preferences page and the `user_preferences` table, and dropping the unused `user_diet_profiles.preferences` column, is a follow-up task.
- Estimated cost is computed from token counts and a per-model price table kept in code.
- Ingredient editing after a meal is saved is limited to the confirmation message in the chat; editing ingredients from history pages is a later improvement.
- Developer status is assigned by the team by adding a row to the developer whitelist; users cannot make themselves developers.
- Run data is stored in the database because the session logger writes local files that do not persist in production; the session logger keeps receiving events for local debugging. A comparison dashboard is a later improvement.
- Running two pipelines side by side is allowed by Constitution §V (v1.1.0, experimental variants): the comparison goal is quality, cost and observability, and the losing variant is retired once the comparison is done.

## Out of Scope (follow-up tasks)

- Web search for unknown dishes (only if needed)
- Shared dish catalog across users
- History matching by similarity (embeddings)
- Energy (kcal) and macronutrients per ingredient, calculated from the stored grams with a food-composition database (BEDCA/USDA), including existing v2 meals
- Exact quantity input (pro version)
- Learning user defaults from corrections
- Recommendations from multiple sources (model, user recipes, community, catalog)
- v1 vs v2 comparison dashboard
- Eval set for v2

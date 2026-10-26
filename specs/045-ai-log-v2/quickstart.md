# Quickstart: AI Meal Logging v2

How to try and verify the feature locally.

## 1. Setup

```bash
git checkout 045-ai-log-v2
npm install
# apply the migration to your Supabase project (SQL editor or CLI)
#   supabase/migrations/00010_ai_log_v2.sql
npm run dev
```

Whitelist yourself as a developer (SQL editor):

```sql
INSERT INTO public.developer_whitelist (user_id, note)
SELECT id, 'log v2 comparison' FROM public.users WHERE email = '<your email>';
```

## 2. Scenarios

| # | Preference | Do | Expect |
|---|------------|----|--------|
| 1 | — | Open `/preferences` as a non-whitelisted user | Options v1 and v2 only; v1 selected |
| 2 | v2 | Chat: "desayuné dos huevos fritos con pan" | Saved at once (high); table with eggs, oil, bread and grams; estimated alert |
| 3 | v2 | Chat: "almorcé una arepa catira" | Not saved (medium); table + "¿Lo guardo…?" |
| 4 | v2 | Reply "sin queso" to #3 | New table without cheese, still pending |
| 5 | v2 | Change the chicken to 80 g in the table, press Guardar | Saved; chicken row marked as your value; run `user_corrected = true` |
| 6 | v2 | Chat again: "cené arepa catira" | Saved at once from history; "Lo he basado en lo que registraste el …" |
| 7 | v2 | Chat: "comí un xyzzy de la abuela" | Open question, no table, nothing saved |
| 8 | v2 | Chat: "300 g de entrecot con ensalada" | Entrecôte 300 g "Indicado"; salad estimated |
| 9 | v2 + shadow v1 (whitelisted) | Chat a meal | One meal saved; two `ai_pipeline_runs` rows with the same `correlation_id`, one `is_shadow = true` |
| 10 | v2 + shadow v1 | Remove yourself from the whitelist, chat a meal | Only a v2 run; Preferences shows v2 |
| 11 | v1 | Chat a meal | Same behaviour as today; one `ai_pipeline_runs` row with `variant = 'v1'` |
| 12 | any | Use the meal form | Same behaviour as today |

## 3. Comparison query

```sql
SELECT variant, is_shadow,
       count(*)                          AS runs,
       round(avg(est_cost_usd), 6)       AS avg_cost_usd,
       round(avg(latency_ms))            AS avg_latency_ms,
       avg(input_tokens + output_tokens) AS avg_tokens,
       avg(confirmation_requested::int)  AS confirm_rate,
       avg(user_corrected::int)          AS correction_rate
FROM public.ai_pipeline_runs
WHERE intent = 'log'
GROUP BY variant, is_shadow;
```

Pairs on the same message: join on `correlation_id`.

## 4. Gates

```bash
npm run test       # unit tests (gate, portions, dish key, cost, draft schema)
npm run eval       # v1 evals unchanged + log-v2 eval
npm run build      # zero type errors
```

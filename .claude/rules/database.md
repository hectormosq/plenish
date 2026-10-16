---
paths:
  - "supabase/migrations/**"
  - "src/actions/**"
  - "src/lib/supabase/**"
  - "docs/database_schema.md"
---

# Database Rules

The migrations in `supabase/migrations/` are the source of truth. `docs/database_schema.md` is the readable reference — update it in the same change as any migration.

## Rules
1. New tables need `ENABLE ROW LEVEL SECURITY` and their policies in the same migration file.
2. Migration filename: `<next_number>_<description>.sql` — check the folder for the current highest number.
3. Foreign keys reference `public.users`, never `auth.users`.
4. Use the Supabase wrappers in `src/lib/supabase/` (`client.ts` for the browser, `server.ts` for RSC and Server Actions). Never create a client inline.
5. Always derive the user from `supabase.auth.getUser()`. Never hardcode or accept a `user_id` from the client.
6. Data mutations go in Server Actions under `src/actions/`. Client components never `fetch()` an `/api/` route to mutate data.

## Tables in use
| Table | Purpose |
|-------|---------|
| `public.users` | Public profile mirroring `auth.users` (trigger-synced) |
| `public.meal_logs` | Meals eaten: `log_text`, `meal_type`, `eaten_at`, `nutrition` (jsonb), `inferred_ingredients`, `recipe_ids`, `is_shared`, `household_id` |
| `public.recipes` | User recipes (`user_id IS NULL` = global); `embedding vector(1536)` exists but is not populated |
| `public.planned_meals` | AI-recommended slots: `planned_date`, `meal_type`, `status` (planned, accepted, dismissed, overridden, expired) |
| `public.user_diet_profiles` | Per-user targets, restrictions and serving sizes (jsonb) |
| `public.households`, `public.household_members` | Household groups, membership and invitations |
| `public.meal_participants` | Co-eaters of a shared meal, with per-user `dismissed` |

`public.weekly_plan` and `public.plan_meals` exist in the schema but no code uses them; `planned_meals` replaced them.

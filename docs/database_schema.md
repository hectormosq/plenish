# Plenish Database Schema

We are using Supabase (PostgreSQL + pgvector).

## Core Tables

### `public.users`
Automatically managed by Supabase Auth (`auth.users`), but we track public profiles here.
- `id` (uuid) PK, references `auth.users`
- `email` (varchar)
- `created_at` (timestamptz)
- `default_language` (varchar) default 'es'

### `public.recipes` (Master Recipe Book)
**Purpose:** Stores exact, structured recipes. These can be global (system-provided) or user-created.
- `id` (uuid) PK
- `user_id` (uuid, nullable) references `public.users` (Null if it's a generic system recipe)
- `name` (varchar) (e.g., "Tacos al Pastor")
- `description` (text)
- `language` (varchar) ('es', 'en') default 'es'
- `ingredients` (text[]) – Array of ingredient strings 
- `instructions` (text[]) – Array of step-by-step instructions
- `embedding` (vector(1536)) – AI vector representation of the recipe for similarity search.

### `public.meal_logs` (What you actually ate)
**Purpose:** A historical log of what the user consumed. It can be a simple description ("Tacos and Cochinita") and optionally link to multiple recipes.
- `id` (uuid) PK
- `user_id` (uuid) references `public.users`
- `log_text` (text) (e.g., "Ate some Tacos al Pastor and a bit of Cochinita Pibil")
- `meal_type` (varchar) ('breakfast', 'lunch', 'dinner', 'snack')
- `recipe_ids` (uuid[]) – Optional pointers to `public.recipes` if the user specifically logged known recipes.
- `eaten_at` (timestamptz) – Date/time this meal was taken.

### `public.weekly_plan`
**Purpose:** Represents a specific 7-day schedule for a user.
- `id` (uuid) PK
- `user_id` (uuid) references `public.users`
- `start_date` (date)
- `end_date` (date)

### `public.plan_meals`
**Purpose:** Represents a single scheduled "slot" in a given weekly plan (e.g., "Tuesday's Lunch").
- `id` (uuid) PK
- `plan_id` (uuid) references `public.weekly_plan`
- `suggested_text` (varchar) (A general suggestion text)
- `recipe_id` (uuid, nullable) references `public.recipes` (If a specific recipe was recommended)
- `day_of_week` (int) 0-6
- `meal_type` (varchar) ('breakfast', 'lunch', 'dinner', 'snack')
- `status` (varchar) ('planned', 'eaten', 'skipped', 'replaced')

## Extension Requirements
- Need `CREATE EXTENSION IF NOT EXISTS vector;` enabled on Supabase.
- A match function (e.g., `match_recipes`) to calculate similarity distance.

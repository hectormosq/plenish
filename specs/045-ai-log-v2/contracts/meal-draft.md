# Contract: `MealDraft` and the chat stream

The table shown in the chat. Produced by the v2 pipeline, sent to the browser as a UI data part, sent back with later requests, and validated on the server every time it is used.

## UI message parts

| Part | When | Payload |
|------|------|---------|
| `data-meal-draft` | v2 `log` turn (direct pipeline path) | `MealDraft` |
| `tool-log_meal_v2` (output) | v2 `mixed` turn (tool path) | `{ draft: MealDraft }` |
| `text` | always | template reply in the user's language |

Typed with the AI SDK `UIMessage<never, { 'meal-draft': MealDraft }>` generic so `MealLogger` gets a typed `part.data`.

## `MealDraft` (Zod, `src/lib/ai/log-v2/schemas.ts`)

```ts
const QuantitySource  = z.enum(['stated', 'estimated', 'history', 'user']);
const ConfidenceLevel = z.enum(['high', 'medium', 'low']);

const DraftIngredient = z.object({
  name:             z.string().trim().min(1).max(120),
  quantity_g:       z.number().positive().max(5000),
  quantity_source:  QuantitySource,
});

const DraftDish = z.object({
  dish_name:         z.string().trim().min(1).max(120),
  dish_key:          z.string(),                 // recomputed on the server; client value ignored
  source:            z.enum(['history', 'model', 'user']),
  confidence_score:  z.number().min(0).max(1).nullable(),
  confidence_level:  ConfidenceLevel,
  ingredients:       z.array(DraftIngredient).min(1).max(40),
});

export const MealDraft = z.object({
  version:      z.literal(1),
  run_id:       z.uuid(),                        // ai_pipeline_runs.id — must belong to the user
  meal_id:      z.uuid().nullable(),             // set when the meal is already saved (auto-save or confirmed)
  status:       z.enum(['pending', 'saved']),
  changes_pending: z.boolean().default(false),   // saved meal with unconfirmed edits (AI rule 8)
  language:     z.enum(['es', 'en']),
  log_text:     z.string().min(1).max(500),
  meal_type:    z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  eaten_at:     z.iso.datetime(),
  is_shared:    z.boolean().default(false),     // from the parse node ("comimos", "cenamos"); added during implementation
  co_eater_ids: z.array(z.uuid()).max(20).nullable().default(null), // co-eaters picked in the input; null = whole household. Filtered to real members on save
  dishes:       z.array(DraftDish).min(1).max(10),
  meal_level:   ConfidenceLevel,                 // recomputed on the server
  nutrition:    NutritionSchema,                 // meal-level, existing schema
});
```

## Server-side handling rules

0. The pipeline stores the table it produced as a `draft` step in `ai_pipeline_runs.steps`; confirmations compare against it (pending) or against the stored rows (saved) to mark the user's edits.
1. **Never trust** `dish_key`, `meal_level`, `quantity_source` transitions or `nutrition` from the client: the server recomputes `dish_key`, compares each row with the previous server-produced version where available, and marks changed rows as `user`.
2. `run_id` must exist in `ai_pipeline_runs` for the authenticated user; `meal_id` (if set) must be the user's own meal. Otherwise → `{ ok: false, error: 'not_found' }`.
3. A draft with `status = 'saved'` can only be updated (`updateMealIngredients`), never inserted again, and only from a draft with `changes_pending = true` that the user confirmed.
4. When rows change (confirm with edits, or update of a saved meal), the server re-runs the `nutrition` node so the meal-level `nutrition` matches the final rows.

## Template replies (i18n keys, `src/lib/i18n/{es,en}.ts`)

| Key | es | en |
|-----|----|----|
| `logV2.saved` | "He registrado tu {mealType} con estos valores:" | "I logged your {mealType} with these values:" |
| `logV2.saved.fromHistory` | "Lo he basado en lo que registraste el {date}." | "Based on what you logged on {date}." |
| `logV2.confirm` | "Esto es lo que voy a registrar. ¿Lo guardo o quieres cambiar algo?" | "Here's what I'll log. Shall I save it, or do you want to change something?" |
| `logV2.question` | "No conozco bien «{dish}». ¿Qué ingredientes lleva?" | "I'm not sure what «{dish}» contains. What are its ingredients?" |
| `logV2.confirmChanges` | "¿Guardo estos cambios?" | "Save these changes?" |
| `logV2.cancelled` | "Vale, no lo registro." | "OK, I won't log it." |
| `logV2.error` | "No he podido analizar la comida. ¿Lo intentas de nuevo?" | "I couldn't analyse that meal. Could you try again?" |
| `logV2.estimatedAlert` | "Cantidades estimadas." | "Quantities are estimates." |
| `logV2.table.*` | Plato, Ingrediente, Cantidad, Estimado, Indicado, Tuyo | Dish, Ingredient, Amount, Estimated, Stated, Yours |
| `logV2.actions.*` | Guardar, Guardar cambios, Cancelar, Añadir ingrediente | Save, Save changes, Cancel, Add ingredient |

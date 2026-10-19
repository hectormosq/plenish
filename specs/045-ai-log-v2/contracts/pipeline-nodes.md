# Contract: v2 pipeline nodes

Location: `src/lib/ai/log-v2/`. Each node is one file with a fixed input/output type, so a later task can replace one implementation without touching the others.

## Shared types (`types.ts`)

```ts
export interface NodeContext {
  model: LanguageModel;
  supabase: SupabaseClient;
  userId: string;            // from supabase.auth.getUser(), never from the model
  tzOffsetMinutes: number;
  now: Date;
}

export interface StepUsage {
  name: string;              // node name
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  summary?: Record<string, unknown>; // small, no prompts
}

export interface PipelineNode<In, Out> {
  name: string;
  run(input: In, ctx: NodeContext): Promise<{ output: Out; usage: StepUsage[] }>;
}
```

## Nodes

| Node | File | Input | Output | Model |
|------|------|-------|--------|-------|
| `parse` | `parse.ts` | `{ text: string; previousAssistantText?: string }` | `{ language: 'es'\|'en'; meal_type; eaten_at; dishes: { dish_name; stated_quantities: { name; grams }[]; listed_ingredients: string[] }[] }` | 1 call |
| `history` | `history.ts` | `{ dishes: ParsedDish[] }` | `{ matches: Map<dish_key, { meal_id; eaten_at; ingredients: DraftIngredient[] }> }` | none |
| `ingredients` | `ingredients.ts` | `{ dish: ParsedDish; language }` | `{ confidence: number; ingredients: { name; quantity_g }[] }` | 1 call per dish, parallel |
| `portions` | `portions.ts` | `{ dish: ParsedDish; ingredients }` | `{ ingredients: { name; quantity_g; quantity_source }[] }` | none |
| `nutrition` | `nutrition.ts` | `{ dishes: ResolvedDish[]; language }` | `{ meal: MealNutrition }` — food groups, protein type, servings, occasional food (existing schema); no kcal/macros | 1 call (skipped when the meal is a single dish found in history: its earlier `nutrition` is reused) |
| `gate` | `gate.ts` | `{ dishes: ResolvedDish[] }` | `{ meal_level; action: 'save'\|'confirm'\|'ask'; askAbout?: string }` | none |
| `revise` | `revise.ts` | `{ draft: MealDraft; userText: string }` | `{ action: 'confirm'\|'edit'\|'cancel'; draft?: MealDraft }` — called only when the router returns `revise` | 1 call |

## Orchestrator (`pipeline.ts`)

```ts
export async function runLogPipelineV2(
  input: { text: string; previousAssistantText?: string; correlationId: string },
  ctx: NodeContext,
): Promise<{
  outcome: 'saved' | 'draft' | 'question' | 'error';
  draft: MealDraft | null;
  replyKey: string;            // i18n key for the template reply
  replyVars: Record<string, string>;
  runId: string;               // ai_pipeline_runs row written by the orchestrator
}>;
```

Order: `parse → history → (ingredients ∥ per unmatched dish) → portions → nutrition → gate → save | draft | question`. Every node's `StepUsage` is collected; the orchestrator writes one `ai_pipeline_runs` row (variant `v2`) and, on `save`, the meal via `saveMealV2`.

## Model-facing schemas

Follow AI rule 4: accept what models produce and clean in code.
- `confidence`: `z.number()` → clamped to [0,1].
- `quantity_g`: `z.number()` → values ≤ 0 replaced by the node's default (100 g) and logged in `summary`.
- `meal_type`: existing `MealTypeEnum` with `.catch()` to the time-of-day default.
- Unknown `dish_name` (empty string) → dropped; if no dishes remain → `outcome = 'question'`.

## Config (`config.ts`)

```ts
export const CONFIDENCE_HIGH = 0.85;
export const CONFIDENCE_LOW  = 0.50;
export const MAX_DISHES      = 10;
export const MAX_INGREDIENTS_PER_DISH = 40;
```

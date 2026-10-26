import { estimateCost, getModelName } from '@/lib/ai/provider';
import { insertRun, updateRun } from '@/lib/ai/runs';
import type { RouterUsage } from '@/lib/ai/router';
import { resolveLogFields } from '@/lib/ai/log-context';
import type { LogContext } from '@/lib/ai/log-context';
import { dishLevel, gateNode } from './gate';
import { historyNode } from './history';
import { ingredientsNode } from './ingredients';
import { nutritionNode } from './nutrition';
import { parseNode } from './parse';
import { portionsNode } from './portions';
import { buildReply } from './reply';
import type { PipelineOutcome } from './reply';
import { saveMealV2 } from './save';
import type { DraftDish, MealDraft } from './schemas';
import type { NodeContext, ResolvedDish, StepUsage } from './types';

// ---------------------------------------------------------------------------
// runLogPipelineV2 — the v2 meal-logging workflow (contracts/pipeline-nodes.md):
//   parse → history → ingredients (parallel, unmatched dishes) → portions
//   → gate → nutrition → save | draft | question
// Every node's usage is stored in one ai_pipeline_runs row (variant 'v2').
// ---------------------------------------------------------------------------

export interface PipelineInput {
  text: string;
  previousAssistantText?: string;
  correlationId: string;
  intent: 'log' | 'mixed' | 'form';
  /** What the input already knows (meal type, date, sharing); it wins over what the parse node infers. */
  logContext?: LogContext | null;
  /** Usage of the router call that sent this message here. */
  routerUsage?: RouterUsage;
  /** Request start, for end-to-end latency. */
  startedAt: number;
}

export interface PipelineResult {
  outcome: PipelineOutcome;
  draft: MealDraft | null;
  reply: string;
  runId: string;
}

export function toDraftDish(d: ResolvedDish): DraftDish {
  return {
    dish_name: d.parsed.dish_name,
    dish_key: d.parsed.dish_key,
    source: d.source,
    confidence_score: d.confidence_score,
    confidence_level: d.confidence_level,
    history_eaten_at: d.history?.eaten_at ?? null,
    ingredients: d.ingredients,
  };
}

export type DraftSnapshot = Pick<DraftDish, 'dish_name' | 'ingredients'>[];

export function draftSnapshot(draft: Pick<MealDraft, 'dishes'>): DraftSnapshot {
  return draft.dishes.map((d) => ({ dish_name: d.dish_name, ingredients: d.ingredients }));
}

export function totals(steps: StepUsage[]) {
  return steps.reduce(
    (acc, s) => ({ input: acc.input + s.input_tokens, output: acc.output + s.output_tokens }),
    { input: 0, output: 0 },
  );
}

export interface PipelineDeps {
  /** Replaces the database write — used by the evals. */
  saveMeal?: typeof saveMealV2;
}

export async function runLogPipelineV2(input: PipelineInput, ctx: NodeContext, deps: PipelineDeps = {}): Promise<PipelineResult> {
  const saveMeal = deps.saveMeal ?? saveMealV2;
  const runId = crypto.randomUUID();
  const model = getModelName();
  const steps: StepUsage[] = input.routerUsage
    ? [{ name: 'router', input_tokens: input.routerUsage.inputTokens, output_tokens: input.routerUsage.outputTokens, latency_ms: input.routerUsage.latencyMs }]
    : [];

  // If this insert fails the draft keeps its run_id anyway: confirmDraft saves
  // without the run, and meal_logs.ai_run_id still blocks a second save.
  await insertRun(ctx.supabase, { id: runId, correlation_id: input.correlationId, variant: 'v2', intent: input.intent, model });

  const finish = async (result: Omit<PipelineResult, 'runId'>, extra: { error?: string; score?: number | null } = {}) => {
    const { input: inTok, output: outTok } = totals(steps);
    // The table as the pipeline produced it: confirmations compare against it to
    // detect user edits without trusting the browser (contracts/meal-draft.md).
    if (result.draft) steps.push({ name: 'draft', input_tokens: 0, output_tokens: 0, latency_ms: 0, summary: { dishes: draftSnapshot(result.draft) } });
    await updateRun(ctx.supabase, runId, {
      meal_log_id: result.draft?.meal_id ?? null,
      input_tokens: inTok,
      output_tokens: outTok,
      est_cost_usd: estimateCost(model, inTok, outTok),
      latency_ms: Date.now() - input.startedAt,
      steps,
      confidence_score: extra.score ?? null,
      confidence_level: result.draft?.meal_level ?? (result.outcome === 'question' ? 'low' : null),
      outcome: result.outcome,
      confirmation_requested: result.outcome === 'draft',
      error: extra.error ?? null,
    });
    return { ...result, runId };
  };

  let language: MealDraft['language'] = 'es';
  try {
    // 1. parse
    const parsed = await parseNode.run({ text: input.text, previousAssistantText: input.previousAssistantText }, ctx);
    steps.push(...parsed.usage);
    const meal = parsed.output;
    language = meal.language;
    if (meal.dishes.length === 0) {
      return finish({ outcome: 'question', draft: null, reply: buildReply('question', null, language, input.text.slice(0, 60)) });
    }

    // 2. history
    const history = await historyNode.run({ dishes: meal.dishes }, ctx);
    steps.push(...history.usage);

    // 3. ingredients (in parallel, only for dishes without history) + 4. portions
    const resolved: ResolvedDish[] = await Promise.all(meal.dishes.map(async (dish): Promise<ResolvedDish> => {
      const match = history.output.matches.get(dish.dish_key) ?? null;
      if (match) {
        const portioned = await portionsNode.run({ dish, ingredients: match.ingredients }, ctx);
        steps.push(...portioned.usage);
        return { parsed: dish, source: 'history', confidence_score: null, confidence_level: 'high', history: match, ingredients: portioned.output.ingredients };
      }
      const inferred = await ingredientsNode.run({ dish, language }, ctx);
      steps.push(...inferred.usage);
      const portioned = await portionsNode.run({ dish, ingredients: inferred.output.ingredients }, ctx);
      steps.push(...portioned.usage);
      const source = inferred.output.fromUser ? 'user' : 'model';
      return {
        parsed: dish,
        source,
        confidence_score: inferred.output.confidence,
        confidence_level: dishLevel(source, inferred.output.confidence),
        history: null,
        ingredients: portioned.output.ingredients,
      };
    }));

    // A dish the model could not break down cannot be shown as a table.
    for (const d of resolved) if (d.ingredients.length === 0) d.confidence_level = 'low';

    // 5. gate — ask before spending a nutrition call on a dish we do not know.
    const gate = await gateNode.run({ dishes: resolved }, ctx);
    steps.push(...gate.usage);
    const lowestScore = resolved.reduce<number | null>(
      (min, d) => (d.confidence_score === null ? min : min === null ? d.confidence_score : Math.min(min, d.confidence_score)),
      null,
    );
    if (gate.output.action === 'ask') {
      return finish(
        { outcome: 'question', draft: null, reply: buildReply('question', null, language, gate.output.askAbout) },
        { score: lowestScore },
      );
    }

    // 6. nutrition — reuse the earlier meal's summary for a repeated single dish.
    const dishes = resolved.map(toDraftDish);
    const single = resolved.length === 1 ? resolved[0] : null;
    const reusable = single?.history?.single_dish && single.history.nutrition
      && single.ingredients.every((i) => i.quantity_source === 'history');
    let nutrition;
    if (reusable && single?.history?.nutrition) {
      nutrition = single.history.nutrition;
      steps.push({ name: 'nutrition', input_tokens: 0, output_tokens: 0, latency_ms: 0, summary: { reused_from: single.history.meal_id } });
    } else {
      const n = await nutritionNode.run({ dishes }, ctx);
      steps.push(...n.usage);
      nutrition = n.output.meal;
    }

    const fields = resolveLogFields(
      { log_text: input.text, meal_type: meal.meal_type, eaten_at: meal.eaten_at, is_shared: meal.is_shared },
      input.logContext ?? null,
      ctx.now.toISOString(),
    );
    const draft: MealDraft = {
      version: 1,
      run_id: runId,
      meal_id: null,
      status: 'pending',
      changes_pending: false,
      language,
      log_text: input.text.trim().slice(0, 500),
      meal_type: fields.meal_type,
      eaten_at: fields.eaten_at,
      is_shared: fields.shared,
      co_eater_ids: fields.coEaterIds === 'all' ? null : fields.coEaterIds,
      dishes,
      meal_level: gate.output.meal_level,
      nutrition,
    };

    // 7. save or ask for confirmation
    if (gate.output.action === 'save') {
      const saved = await saveMeal(ctx.supabase, ctx.userId, draft);
      if (!saved.ok) {
        return finish({ outcome: 'error', draft: null, reply: buildReply('error', null, language) }, { error: saved.error, score: lowestScore });
      }
      const savedDraft: MealDraft = { ...draft, status: 'saved', meal_id: saved.mealId };
      return finish({ outcome: 'saved', draft: savedDraft, reply: buildReply('saved', savedDraft, language) }, { score: lowestScore });
    }
    return finish({ outcome: 'draft', draft, reply: buildReply('draft', draft, language) }, { score: lowestScore });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('Log v2 pipeline failed.', message);
    return finish({ outcome: 'error', draft: null, reply: buildReply('error', null, language) }, { error: message.slice(0, 1000) });
  }
}

// Log v2 eval — runs the v2 logging pipeline on common dishes and on repeated
// dishes from history. Database reads use a fake client; nothing is written.
// Costs API calls (≈3 small calls per dish). Spec: specs/045-ai-log-v2 (SC-001, SC-003).
// Env: EVAL_PROVIDER=google|openai (default openai), EVAL_LIMIT=<n> for a subset.

import { describe, it, expect } from 'vitest';
import { getAIModel, getModelName } from '@/lib/ai/provider';
import { runLogPipelineV2 } from '@/lib/ai/log-v2/pipeline';
import { normalizeDishKey } from '@/lib/ai/log-v2/dish-key';
import type { MealDraft } from '@/lib/ai/log-v2/schemas';
import type { LogContext } from '@/lib/ai/log-context';
import { createLogV2FakeSupabase, EVAL_USER_ID } from './lib/fake-supabase';
import type { FakeIngredientRow } from './lib/fake-supabase';
import { printPassRates, saveResults } from './lib/report';
import dishCases from './datasets/log-v2.json';

interface DishCase {
  id: string;
  text: string;
  expected: string[];
  stated?: Record<string, number>;
  /** An unknown dish: the pipeline must ask instead of guessing a table. */
  expectQuestion?: boolean;
}

const TZ_OFFSET = -120;
const CONCURRENCY = 4;
const COVERAGE_TARGET = 0.8;

const norm = (s: string) => normalizeDishKey(s);
const MAX_SERVING_G = 400;

/** One serving per food: no recipe-sized amounts, no food counted in two dishes. */
function servingSized(draft: MealDraft | null): boolean {
  if (!draft) return false;
  const perDish = draft.dishes.map((d) => new Set(d.ingredients.map((i) => norm(i.name))));
  const dishKeys = draft.dishes.map((d) => d.dish_key);
  const duplicated = perDish.some((names, i) => [...names].some((n) => dishKeys.some((k, j) => j !== i && k === n)));
  return !duplicated && draft.dishes.every((d) => d.ingredients.every((i) => i.quantity_g <= MAX_SERVING_G));
}

// Flavor-only ingredients that must not reach the table (matched on the first word).
const SEASONINGS = new Set(['agua', 'sal', 'pimienta', 'especias', 'ajo', 'comino', 'oregano', 'perejil', 'cilantro', 'laurel', 'caldo', 'water', 'salt', 'spices', 'garlic']);

function noSeasonings(draft: MealDraft | null): boolean {
  return !!draft && draft.dishes.every((d) => d.ingredients.every((i) => !SEASONINGS.has(norm(i.name).split(' ')[0])));
}

function coverage(draft: MealDraft | null, expected: string[]): number {
  if (!draft || expected.length === 0) return 0;
  const names = draft.dishes.flatMap((d) => d.ingredients.map((i) => norm(i.name)));
  const found = expected.filter((e) => names.some((n) => n.includes(norm(e).slice(0, Math.max(4, norm(e).length - 1)))));
  return found.length / expected.length;
}

const NUTRITION = { food_groups: ['hidratos', 'proteinas'], protein_type: 'white_meat', servings: { grains: 1, meat: 1, dairy: 1 }, has_occasional_food: false, portion_confidence: 'estimated' };

function historyRows(mealId: string, dishName: string, eatenAt: string, ingredients: [string, number][]): FakeIngredientRow[] {
  return ingredients.map(([name, quantity_g], position) => ({
    meal_log_id: mealId,
    dish_key: normalizeDishKey(dishName),
    dish_name: dishName,
    name,
    quantity_g,
    position,
    created_at: eatenAt,
    meal_logs: { eaten_at: eatenAt, nutrition: NUTRITION },
  }));
}

const HISTORY: FakeIngredientRow[] = [
  ...historyRows('00000000-0000-4000-8000-0000000000a1', 'Arepa catira', '2026-10-12T13:00:00.000Z', [['Harina de maíz', 120], ['Pollo mechado', 80], ['Queso amarillo', 40], ['Mantequilla', 10]]),
  ...historyRows('00000000-0000-4000-8000-0000000000a2', 'Tortilla de patatas', '2026-10-10T20:30:00.000Z', [['Huevo', 120], ['Patata', 150], ['Aceite de oliva', 15]]),
  ...historyRows('00000000-0000-4000-8000-0000000000a3', 'Paella', '2026-10-05T14:00:00.000Z', [['Arroz', 80], ['Marisco', 100], ['Aceite de oliva', 10]]),
];

const HISTORY_CASES = [
  { id: 'h-01', text: 'cené arepa catira', dish: 'arepa catira', rows: 4 },
  { id: 'h-02', text: 'Tortilla de Patatas para cenar', dish: 'tortilla de patatas', rows: 3 },
  { id: 'h-03', text: 'comí una paella', dish: 'paella', rows: 3 },
];

async function runPipeline(text: string, history: FakeIngredientRow[], logContext: LogContext | null = null) {
  const supabase = createLogV2FakeSupabase(history);
  return runLogPipelineV2(
    { text, correlationId: crypto.randomUUID(), intent: logContext?.mealType ? 'form' : 'log', logContext, startedAt: Date.now() },
    { model: getAIModel(), supabase, userId: EVAL_USER_ID, tzOffsetMinutes: TZ_OFFSET, now: new Date('2026-10-19T12:30:00.000Z') },
    { saveMeal: async () => ({ ok: true, mealId: '00000000-0000-4000-8000-00000000beef' }) },
  );
}

async function runCase(c: DishCase) {
  try {
    const started = Date.now();
    const result = await runPipeline(c.text, []);
    if (c.expectQuestion) {
      return {
        id: c.id, text: c.text, outcome: result.outcome, level: result.draft?.meal_level ?? null,
        scores: result.draft?.dishes.map((d) => d.confidence_score) ?? [], ingredients: [] as string[], coverage: null as number | null,
        latencyMs: Date.now() - started,
        checks: { 'no error': result.outcome !== 'error', 'unknown dish: asks': result.outcome === 'question' } as Record<string, boolean>,
      };
    }
    const cov = coverage(result.draft, c.expected);
    const stated = c.stated
      ? Object.entries(c.stated).every(([name, g]) =>
        result.draft?.dishes.some((d) => d.ingredients.some((i) => norm(i.name).includes(norm(name)) && i.quantity_g === g && i.quantity_source === 'stated')))
      : true;
    return {
      id: c.id,
      text: c.text,
      outcome: result.outcome,
      level: result.draft?.meal_level ?? null,
      scores: result.draft?.dishes.map((d) => d.confidence_score) ?? [],
      ingredients: result.draft?.dishes.flatMap((d) => d.ingredients.map((i) => `${i.name} ${i.quantity_g}g`)) ?? [],
      coverage: cov,
      latencyMs: Date.now() - started,
      checks: {
        'no error':                 result.outcome !== 'error',
        'table shown (saved/draft)': result.outcome === 'saved' || result.outcome === 'draft',
        [`main ingredients ≥ ${COVERAGE_TARGET * 100}%`]: cov >= COVERAGE_TARGET,
        'stated quantities kept':   stated,
        'serving-sized, no dupes':  servingSized(result.draft),
        'no seasonings':            noSeasonings(result.draft),
        'saved without asking':     result.outcome === 'saved',
      } as Record<string, boolean>,
    };
  } catch (err) {
    return {
      id: c.id, text: c.text, outcome: 'error', level: null, scores: [], ingredients: [String(err).slice(0, 200)],
      coverage: 0, latencyMs: 0, checks: { 'no error': false } as Record<string, boolean>,
    };
  }
}

async function runHistoryCase(c: (typeof HISTORY_CASES)[number]) {
  const result = await runPipeline(c.text, HISTORY);
  const dish = result.draft?.dishes.find((d) => d.dish_key === normalizeDishKey(c.dish));
  return {
    id: c.id,
    text: c.text,
    outcome: result.outcome,
    source: dish?.source ?? null,
    checks: {
      'reused from history':  dish?.source === 'history' && dish.ingredients.length === c.rows,
      'saved without asking': result.outcome === 'saved',
      'mentions earlier meal': /registraste|logged on/.test(result.reply),
    } as Record<string, boolean>,
  };
}

// The input already knows meal type, day and sharing (a calendar cell or a chip): those values win.
const CO_EATER = '00000000-0000-4000-8000-0000000000c1';
const CONTEXT_CASES: { id: string; text: string; logContext: LogContext; expect: Pick<MealDraft, 'meal_type' | 'eaten_at' | 'is_shared' | 'co_eater_ids'> }[] = [
  { id: 'c-01', text: 'Arepa con perico', logContext: { mealType: 'breakfast', date: '2026-10-18', shareState: 'partial', coEaterIds: [CO_EATER] },
    expect: { meal_type: 'breakfast', eaten_at: '2026-10-18T12:00:00.000Z', is_shared: true, co_eater_ids: [CO_EATER] } },
  { id: 'c-02', text: 'cené tortilla de patatas', logContext: { mealType: 'lunch', date: null, shareState: 'just-me' },
    expect: { meal_type: 'lunch', eaten_at: '2026-10-19T12:30:00.000Z', is_shared: false, co_eater_ids: null } },
];

async function runContextCase(c: (typeof CONTEXT_CASES)[number]) {
  const result = await runPipeline(c.text, [], c.logContext);
  const d = result.draft;
  return {
    id: c.id,
    text: c.text,
    outcome: result.outcome,
    checks: {
      'table shown (saved/draft)': result.outcome === 'saved' || result.outcome === 'draft',
      'input meal type kept':      d?.meal_type === c.expect.meal_type,
      'input day kept':            d?.eaten_at === c.expect.eaten_at,
      'input sharing kept':        d?.is_shared === c.expect.is_shared && JSON.stringify(d?.co_eater_ids) === JSON.stringify(c.expect.co_eater_ids),
    } as Record<string, boolean>,
  };
}

async function inBatches<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return out;
}

describe('log v2 eval', () => {
  it('breaks common dishes into their main ingredients', async () => {
    const limit = Number(process.env.EVAL_LIMIT) || undefined;
    const cases = (dishCases as DishCase[]).slice(0, limit);
    const results = await inBatches(cases, CONCURRENCY, runCase);

    printPassRates(`Log v2 — dishes (${getModelName()})`, results);
    const scored = results.filter((r) => r.coverage !== null);
    const avg = scored.reduce((n, r) => n + (r.coverage ?? 0), 0) / scored.length;
    console.log(`Average ingredient coverage: ${Math.round(avg * 100)}% (target ${COVERAGE_TARGET * 100}%)`);
    console.table(results.map((r) => ({
      id: r.id,
      text: r.text.slice(0, 32),
      outcome: r.outcome,
      level: r.level,
      coverage: r.coverage === null ? '—' : `${Math.round(r.coverage * 100)}%`,
      ingredients: r.ingredients.join(', ').slice(0, 70),
    })));
    console.log(`Results saved to ${saveResults('log-v2', { model: getModelName(), averageCoverage: avg, results })}`);
    expect(results.length).toBeGreaterThan(0);
  });

  it('reuses ingredients of a dish logged before', async () => {
    const results = await Promise.all(HISTORY_CASES.map(runHistoryCase));
    printPassRates(`Log v2 — history (${getModelName()})`, results);
    console.table(results.map((r) => ({ id: r.id, text: r.text, outcome: r.outcome, source: r.source })));
    console.log(`Results saved to ${saveResults('log-v2-history', results)}`);
    expect(results.length).toBe(HISTORY_CASES.length);
  });

  it('keeps the meal type, day and sharing picked in the input', async () => {
    const results = await Promise.all(CONTEXT_CASES.map(runContextCase));
    printPassRates(`Log v2 — input context (${getModelName()})`, results);
    console.log(`Results saved to ${saveResults('log-v2-context', results)}`);
    expect(results.length).toBe(CONTEXT_CASES.length);
  });
});

// Logging eval — replays real logged meals through the model with stubbed tools.
// Costs API calls. Dataset: node evals/build-dataset.mjs
// Env: EVAL_LIMIT=<n> to run a subset, EVAL_PROVIDER=google|openai (default openai).

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { generateText, stepCountIs } from 'ai';
import type { ToolSet } from 'ai';
import { getAIModel, getModelName, getBaseSystemPrompt, getFullSystemPrompt } from '@/lib/ai/provider';
import { resolvePromptTier } from '@/lib/ai/intent-classifier';
import { createMealTools } from '@/lib/ai/tools/meal-tools';
import { createFakeSupabase, EVAL_HOUSEHOLD, EVAL_USER_ID } from './lib/fake-supabase';
import { printPassRates, saveResults } from './lib/report';

interface LoggingCase {
  id: string;
  text: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  date: string;
  shareState: 'all' | 'partial' | 'just-me';
}

interface LoggedMealInput {
  log_text?: string;
  meal_type?: string;
  eaten_at?: string;
  is_shared?: boolean;
  nutrition?: unknown;
}

const DATASET = join('evals', 'datasets', 'logging.local.json');
const CONCURRENCY = 4;
const MAX_STEPS = 7; // same limit as the chat route
const TZ_OFFSET = -120;

// Mirrors how MealLogger composes the message it sends to the chat route.
function buildUiMessage(c: LoggingCase): string {
  const parts = [`[date: ${c.date}]`, `[${c.mealType}]`];
  if (c.shareState === 'all') parts.push('[shared with: all]');
  return `${parts.join(' ')} ${c.text}`;
}

// Keeps a tool's description and schema but replaces its side effects.
function stub<T extends object>(realTool: T, execute: (input: never) => Promise<unknown>): T {
  return { ...realTool, execute } as T;
}

async function runCase(c: LoggingCase) {
  const message = buildUiMessage(c);
  const { tier } = resolvePromptTier(message);
  const supabase = createFakeSupabase(EVAL_HOUSEHOLD);
  const system = tier === 'base'
    ? await getBaseSystemPrompt(TZ_OFFSET, EVAL_USER_ID, supabase)
    : await getFullSystemPrompt(TZ_OFFSET, EVAL_USER_ID, supabase);

  const executed: LoggedMealInput[] = [];
  const real = createMealTools(TZ_OFFSET);
  const logMeal = stub(real.logMealTool, async (input: LoggedMealInput) => {
    executed.push(input);
    return {
      success: true,
      meal_id: '00000000-0000-4000-8000-00000000beef',
      meal_type: input.meal_type,
      nutrition: input.nutrition,
      is_shared: input.is_shared ?? false,
      participants: [],
      recipe_suggestion: null,
    };
  });
  const noop = async () => ({ success: true, meals: [], count: 0 });

  // Cast: the two tier-specific tool sets do not unify into one inferred type.
  const tools = (tier === 'base'
    ? { log_meal: logMeal }
    : {
        log_meal:          logMeal,
        get_meals:         stub(real.getMealsTool, noop),
        save_recipe:       stub(real.saveRecipeTool, noop),
        delete_meal:       stub(real.deleteMealTool, noop),
        update_meal:       stub(real.updateMealTool, noop),
        get_daily_summary: stub(real.getDailySummaryTool, noop),
      }) as unknown as ToolSet;

  try {
    const result = await generateText({
      model: getAIModel(),
      system,
      messages: [{ role: 'user', content: message }],
      tools,
      stopWhen: stepCountIs(MAX_STEPS),
    });

    const attempts = result.steps
      .flatMap((s) => s.toolCalls)
      .filter((tc) => tc.toolName === 'log_meal').length;
    // Rejected tool calls (schema validation) come back to the model as tool errors.
    const toolErrors = result.steps
      .flatMap((s) => s.content)
      .filter((part) => part.type === 'tool-error')
      .map((part) => {
        const error = (part as { error: unknown }).error;
        return (error instanceof Error ? error.message : String(error)).replace(/\s+/g, ' ').slice(0, 400);
      });
    const logged = executed[0];
    const expectShared = c.shareState === 'all';

    return {
      id: c.id,
      text: c.text,
      tier,
      attempts,
      executed: executed.length,
      steps: result.steps.length,
      reply: result.text,
      toolErrors,
      inputTokens: result.totalUsage.inputTokens ?? 0,
      outputTokens: result.totalUsage.outputTokens ?? 0,
      error: null as string | null,
      checks: {
        'routed to base tier':      tier === 'base',
        'meal was logged':          executed.length >= 1,
        'logged exactly once':      executed.length === 1,
        'single tool attempt':      attempts === 1,
        'meal_type matches chip':   logged?.meal_type === c.mealType,
        'date matches chip':        logged?.eaten_at?.startsWith(c.date) ?? false,
        'sharing matches chip':     c.shareState === 'partial' || (logged?.is_shared ?? false) === expectShared,
        'prefixes stripped':        logged?.log_text !== undefined && !logged.log_text.includes('['),
        'short confirmation reply': result.text.length > 0 && result.text.length <= 120,
      } as Record<string, boolean>,
    };
  } catch (err) {
    return {
      id: c.id,
      text: c.text,
      tier,
      attempts: 0,
      executed: executed.length,
      steps: 0,
      reply: '',
      toolErrors: [] as string[],
      inputTokens: 0,
      outputTokens: 0,
      error: err instanceof Error ? err.message : String(err),
      checks: { 'completed without error': false } as Record<string, boolean>,
    };
  }
}

async function runPool<T, R>(items: T[], worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await worker(items[i]);
      }
    }),
  );
  return results;
}

describe('logging eval', () => {
  it.skipIf(!existsSync(DATASET))('logs each meal once with the right fields', async () => {
    const all = JSON.parse(readFileSync(DATASET, 'utf8')) as LoggingCase[];
    const limit = Number(process.env.EVAL_LIMIT);
    const cases = Number.isFinite(limit) && limit > 0 ? all.slice(0, limit) : all;

    const results = await runPool(cases, runCase);

    const model = getModelName();
    printPassRates(`Logging — ${model}`, results);

    const attempts = results.reduce((n, r) => n + r.attempts, 0);
    const inputTokens = results.reduce((n, r) => n + r.inputTokens, 0);
    const outputTokens = results.reduce((n, r) => n + r.outputTokens, 0);
    console.log(
      `log_meal attempts: ${attempts} for ${results.length} messages ` +
      `(${(attempts / results.length).toFixed(2)} per message) | ` +
      `tokens: ${inputTokens} in / ${outputTokens} out`,
    );

    const problems = results.filter((r) => r.error || r.attempts !== 1 || r.executed !== 1);
    if (problems.length > 0) {
      console.log('Cases with errors, retries or no log:');
      console.table(
        problems.map((p) => ({
          id: p.id,
          text: p.text.slice(0, 40),
          attempts: p.attempts,
          executed: p.executed,
          error: p.error?.slice(0, 60) ?? '',
        })),
      );
    }

    const errorCounts = new Map<string, number>();
    for (const message of results.flatMap((r) => r.toolErrors)) {
      errorCounts.set(message, (errorCounts.get(message) ?? 0) + 1);
    }
    if (errorCounts.size > 0) {
      console.log('Tool errors (most frequent first):');
      [...errorCounts.entries()]
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .forEach(([message, count]) => console.log(`  ×${count}  ${message}`));
    }

    console.log(`Results saved to ${saveResults('logging', { model, attempts, inputTokens, outputTokens, results })}`);
    expect(results.length).toBeGreaterThan(0);
  });
});

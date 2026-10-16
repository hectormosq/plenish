// Logging eval — replays real logged meals through the model the way the logging form sends them.
// Uses the same turn setup as the chat route; only the database write is replaced.
// Costs API calls. Dataset: node evals/build-dataset.mjs
// Env: EVAL_LIMIT=<n> to run a subset, EVAL_PROVIDER=google|openai (default openai).

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { generateText } from 'ai';
import { getAIModel, getModelName } from '@/lib/ai/provider';
import { buildChatTurn, turnLoopSettings } from '@/lib/ai/chat-turn';
import type { LogContext } from '@/lib/ai/log-context';
import type { MealToSave } from '@/lib/ai/tools/meal-tools';
import { createFakeSupabase, EVAL_HOUSEHOLD, EVAL_USER_ID } from './lib/fake-supabase';
import { printPassRates, saveResults } from './lib/report';

interface LoggingCase {
  id: string;
  text: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  date: string;
  shareState: 'all' | 'partial' | 'just-me';
}

const DATASET = join('evals', 'datasets', 'logging.local.json');
const CONCURRENCY = 4;
const TZ_OFFSET = -120;

// Mirrors the request fields MealLogger sends next to the message.
function buildLogContext(c: LoggingCase): LogContext {
  return { mealType: c.mealType, date: c.date, shareState: c.shareState, coEaterIds: null };
}

// "Invalid input for tool …: Value: {…}. Error message: […]" — keep the part that says why.
function describeToolError(error: unknown): string {
  const message = (error instanceof Error ? error.message : String(error)).replace(/\s+/g, ' ');
  const reason = message.split('Error message:')[1];
  return (reason ?? message).trim().slice(0, 300);
}

async function runCase(c: LoggingCase) {
  const saved: MealToSave[] = [];

  try {
    const turn = await buildChatTurn({
      lastUserText:    c.text,
      logContext:      buildLogContext(c),
      tzOffsetMinutes: TZ_OFFSET,
      userId:          EVAL_USER_ID,
      supabase:        createFakeSupabase(EVAL_HOUSEHOLD),
      saveMealLog: async (meal) => {
        saved.push(meal);
        return {
          success: true,
          meal_id: '00000000-0000-4000-8000-00000000beef',
          meal_type: meal.meal_type,
          nutrition: meal.nutrition,
          is_shared: meal.shared,
          participants: [],
          recipe_suggestion: null,
        };
      },
    });

    const result = await generateText({
      model: getAIModel(),
      system: turn.system,
      messages: [{ role: 'user', content: c.text }],
      tools: turn.tools,
      ...turnLoopSettings(turn),
    });

    const attempts = result.steps
      .flatMap((s) => s.toolCalls)
      .filter((tc) => tc.toolName === 'log_meal').length;
    // Rejected tool calls (schema validation) come back to the model as tool errors.
    const toolErrors = result.steps
      .flatMap((s) => s.content)
      .filter((part) => part.type === 'tool-error')
      .map((part) => describeToolError((part as { error: unknown }).error));
    const meal = saved[0];

    return {
      id: c.id,
      text: c.text,
      tier: turn.tier,
      mode: turn.mode,
      attempts,
      saved: saved.length,
      steps: result.steps.length,
      reply: result.text,
      toolErrors,
      inputTokens: result.totalUsage.inputTokens ?? 0,
      outputTokens: result.totalUsage.outputTokens ?? 0,
      error: null as string | null,
      checks: {
        'routed to base tier':      turn.tier === 'base',
        'meal was logged':          saved.length >= 1,
        'logged exactly once':      saved.length === 1,
        'single tool attempt':      attempts === 1,
        'meal_type matches chip':   meal?.meal_type === c.mealType,
        'date matches chip':        meal?.eaten_at.startsWith(c.date) ?? false,
        'sharing matches chip':     meal !== undefined && meal.shared === (c.shareState !== 'just-me'),
        'description kept':         meal !== undefined && meal.log_text.length > 0 && !meal.log_text.includes('['),
        'short confirmation reply': result.text.length > 0 && result.text.length <= 120,
      } as Record<string, boolean>,
    };
  } catch (err) {
    return {
      id: c.id,
      text: c.text,
      tier: 'base' as const,
      mode: 'form' as const,
      attempts: 0,
      saved: saved.length,
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

    const problems = results.filter((r) => r.error || r.attempts !== 1 || r.saved !== 1);
    if (problems.length > 0) {
      console.log('Cases with errors, retries or no log:');
      console.table(
        problems.map((p) => ({
          id: p.id,
          text: p.text.slice(0, 40),
          attempts: p.attempts,
          saved: p.saved,
          error: p.error?.slice(0, 80) ?? '',
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

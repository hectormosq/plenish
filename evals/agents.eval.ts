// Agents eval — runs whole chat turns (router + agent) with every tool stubbed,
// and checks which tools each agent calls. Costs API calls.
// Env: EVAL_PROVIDER=google|openai (default openai).

import { describe, it, expect } from 'vitest';
import { generateText } from 'ai';
import type { ToolSet } from 'ai';
import { getAIModel, getModelName } from '@/lib/ai/provider';
import { buildChatTurn, turnLoopSettings } from '@/lib/ai/chat-turn';
import type { Intent } from '@/lib/ai/router';
import { createFakeSupabase, EVAL_HOUSEHOLD, EVAL_USER_ID } from './lib/fake-supabase';
import { printPassRates, saveResults } from './lib/report';
import routingCases from './datasets/routing.json';

interface RoutingCase {
  id: string;
  text: string;
  previous?: string;
  expectedIntent: Intent;
}

const TZ_OFFSET = -120;
const CONCURRENCY = 4;

// Canned tool outputs, so agents can continue past their first call.
const STUB_OUTPUTS: Record<string, unknown> = {
  get_meals: {
    count: 2,
    meals: [
      { id: '00000000-0000-4000-8000-0000000000m1', log_text: 'Tostadas con huevo', meal_type: 'breakfast', eaten_at: new Date().toISOString() },
      { id: '00000000-0000-4000-8000-0000000000m2', log_text: 'Lentejas con arroz', meal_type: 'lunch', eaten_at: new Date().toISOString() },
    ],
  },
  get_daily_summary: {
    period: 'today',
    meals_logged: 2,
    daily: { dairy: { consumed: 0, min: 2, max: 4 }, fruit_veg: { consumed: 1, min: 4, max: 5 }, grains: { consumed: 3, min: 4, max: 6 } },
    meals: [],
    protein_types_this_week: ['eggs', 'legumes'],
  },
  plan_meals: { planned: [], summary: 'Planned: **Salmón con verduras** for dinner.' },
  log_meal: { success: true, meal_id: '00000000-0000-4000-8000-00000000beef', recipe_suggestion: null },
  save_recipe: { success: true },
  update_meal: { success: true },
  delete_meal: { success: true },
};

function recordingTools(tools: ToolSet, calls: string[]): ToolSet {
  return Object.fromEntries(
    Object.entries(tools).map(([name, t]) => [
      name,
      { ...t, execute: async () => { calls.push(name); return STUB_OUTPUTS[name] ?? { success: true }; } },
    ]),
  ) as ToolSet;
}

/** What each agent must (and must not) do on a first message with no confirmation given. */
function expectations(intent: Intent, calls: string[]): Record<string, boolean> {
  const called = (name: string) => calls.includes(name);
  const checks: Record<string, boolean> = {
    // No case contains a confirmation, so nothing may be edited or deleted yet.
    'no edit or delete without confirmation': !called('update_meal') && !called('delete_meal'),
  };
  switch (intent) {
    case 'log':
      checks['log: logs the meal'] = called('log_meal');
      break;
    case 'manage':
      checks['manage: looks up meals'] = called('get_meals');
      break;
    case 'plan':
      checks['plan: reads progress or plans'] = called('get_daily_summary') || called('plan_meals');
      break;
    case 'chat':
      checks['chat: calls no tools'] = calls.length === 0;
      break;
    case 'mixed':
      checks['mixed: logs the meal'] = called('log_meal');
      break;
  }
  return checks;
}

async function runCase(c: RoutingCase) {
  const model = getAIModel();
  const calls: string[] = [];
  try {
    const turn = await buildChatTurn({
      model,
      lastUserText: c.text,
      logContext: null,
      tzOffsetMinutes: TZ_OFFSET,
      userId: EVAL_USER_ID,
      supabase: createFakeSupabase(EVAL_HOUSEHOLD),
    });
    const result = await generateText({
      model,
      system: turn.system,
      messages: [{ role: 'user', content: c.text }],
      tools: recordingTools(turn.tools, calls),
      ...turnLoopSettings(turn),
    });
    return {
      id: c.id,
      text: c.text,
      expectedIntent: c.expectedIntent,
      agent: turn.agent,
      calls,
      finishReason: result.finishReason,
      reply: result.text.slice(0, 200),
      checks: {
        'routed to expected agent': turn.agent === c.expectedIntent,
        ...expectations(c.expectedIntent, calls),
        'finished within step limit': result.finishReason !== 'tool-calls',
      },
    };
  } catch (err) {
    return {
      id: c.id,
      text: c.text,
      expectedIntent: c.expectedIntent,
      agent: null,
      calls,
      finishReason: 'error',
      reply: err instanceof Error ? err.message : String(err),
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

describe('agents eval', () => {
  it('each agent calls the tools its intent needs', async () => {
    // Follow-up replies ("sí") need a real conversation history; they are covered by the routing eval.
    const cases = (routingCases as RoutingCase[]).filter((c) => !c.previous);
    const results = await runPool(cases, runCase);

    printPassRates(`Agents — ${getModelName()}`, results);

    const failures = results.filter((r) => Object.values(r.checks).some((ok) => !ok));
    if (failures.length > 0) {
      console.log('Cases with a failed check:');
      console.table(failures.map((f) => ({
        id: f.id,
        text: f.text.slice(0, 40),
        expected: f.expectedIntent,
        agent: f.agent,
        calls: f.calls.join(', '),
        failed: Object.entries(f.checks).filter(([, ok]) => !ok).map(([n]) => n).join('; '),
      })));
    }

    console.log(`Results saved to ${saveResults('agents', results)}`);
    expect(results.length).toBeGreaterThan(0);
  });
});

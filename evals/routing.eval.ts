// Routing eval — compares the keyword classifier with the model router on the same messages.
// The keyword run is free; the router run makes one small model call per message.
// Env: EVAL_PROVIDER=google|openai (default openai), EVAL_SKIP_MODEL=1 to run keywords only.

import { describe, it, expect } from 'vitest';
import { getAIModel, getModelName } from '@/lib/ai/provider';
import { keywordRoute, routeMessage } from '@/lib/ai/router';
import type { Intent } from '@/lib/ai/router';
import { printPassRates, saveResults } from './lib/report';
import routingCases from './datasets/routing.json';

interface RoutingCase {
  id: string;
  text: string;
  previous?: string;
  expectedIntent: Intent;
}

const cases = routingCases as RoutingCase[];

function score(name: string, results: { id: string; text: string; expectedIntent: Intent; intent: Intent; reason: string }[]) {
  const checked = results.map((r) => ({
    ...r,
    checks: {
      [`intent:${r.expectedIntent}`]: r.intent === r.expectedIntent,
      'intent:all': r.intent === r.expectedIntent,
    },
  }));
  const rates = printPassRates(name, checked);

  const misses = checked.filter((r) => !r.checks['intent:all']);
  if (misses.length > 0) {
    console.log(`Misrouted by ${name}:`);
    console.table(misses.map((m) => ({
      id: m.id,
      text: m.text.slice(0, 50),
      expected: m.expectedIntent,
      got: m.intent,
      reason: m.reason.slice(0, 50),
    })));
  }
  return { rates, results: checked };
}

describe('routing eval', () => {
  it('keyword classifier', () => {
    const results = cases.map((c) => ({ ...c, ...keywordRoute(c.text) }));
    const run = score('Routing — keyword classifier', results);
    console.log(`Results saved to ${saveResults('routing-keyword', run)}`);
    expect(results.length).toBeGreaterThan(0);
  });

  it.skipIf(process.env.EVAL_SKIP_MODEL === '1')('model router', async () => {
    const model = getAIModel();
    const results = await Promise.all(
      cases.map(async (c) => ({ ...c, ...(await routeMessage(model, c.text, c.previous)) })),
    );
    const fallbacks = results.filter((r) => r.source === 'keyword').length;
    const run = score(`Routing — model router (${getModelName()})`, results);
    if (fallbacks > 0) console.log(`Router calls that failed and fell back to keywords: ${fallbacks}`);
    console.log(`Results saved to ${saveResults('routing-model', run)}`);
    expect(results.length).toBeGreaterThan(0);
  });
});

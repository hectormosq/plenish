// Routing eval — deterministic, no model calls.
// Checks that each message is routed to a prompt tier that can serve it.

import { describe, it, expect } from 'vitest';
import { resolvePromptTier } from '@/lib/ai/intent-classifier';
import type { PromptTier } from '@/lib/ai/intent-classifier';
import { printPassRates, saveResults } from './lib/report';
import routingCases from './datasets/routing.json';

interface RoutingCase {
  id: string;
  text: string;
  expectedTier: PromptTier;
  kind: string;
}

describe('routing eval', () => {
  it('routes each message to the expected prompt tier', () => {
    const results = (routingCases as RoutingCase[]).map((c) => {
      const { tier, intent, signals } = resolvePromptTier(c.text);
      return {
        id: c.id,
        kind: c.kind,
        text: c.text,
        expectedTier: c.expectedTier,
        tier,
        intent,
        signals,
        checks: { [`tier:${c.kind}`]: tier === c.expectedTier, 'tier:all': tier === c.expectedTier },
      };
    });

    printPassRates('Routing', results);

    const failures = results.filter((r) => !r.checks['tier:all']);
    if (failures.length > 0) {
      console.log('Misrouted:');
      console.table(
        failures.map((f) => ({
          id: f.id,
          text: f.text,
          expected: f.expectedTier,
          got: f.tier,
          intent: f.intent,
          signals: f.signals.join(', '),
        })),
      );
    }

    console.log(`Results saved to ${saveResults('routing', results)}`);
    expect(results.length).toBeGreaterThan(0);
  });
});

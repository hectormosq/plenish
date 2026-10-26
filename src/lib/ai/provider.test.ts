import { describe, expect, it } from 'vitest';
import { estimateCost, MODEL_PRICES } from './provider';

describe('estimateCost', () => {
  it('uses the per-million prices of a known model', () => {
    const price = MODEL_PRICES['gpt-4o-mini'];
    expect(estimateCost('gpt-4o-mini', 1_000_000, 1_000_000)).toBeCloseTo(price.inputPerM + price.outputPerM);
    expect(estimateCost('gpt-4o-mini', 2000, 500)).toBeCloseTo((2000 * price.inputPerM + 500 * price.outputPerM) / 1_000_000);
  });

  it('returns null for a model without a price', () => {
    expect(estimateCost('unknown-model', 100, 100)).toBeNull();
  });
});

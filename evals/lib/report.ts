import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface CheckedCase {
  id: string;
  checks: Record<string, boolean>;
}

/** Prints a pass-rate table per check and returns the rates (0–1). */
export function printPassRates(title: string, cases: CheckedCase[]): Record<string, number> {
  const totals: Record<string, { pass: number; total: number }> = {};
  for (const c of cases) {
    for (const [name, ok] of Object.entries(c.checks)) {
      totals[name] ??= { pass: 0, total: 0 };
      totals[name].total += 1;
      if (ok) totals[name].pass += 1;
    }
  }

  const rates: Record<string, number> = {};
  const rows = Object.entries(totals).map(([check, { pass, total }]) => {
    rates[check] = total === 0 ? 0 : pass / total;
    return { check, passed: `${pass}/${total}`, rate: `${Math.round(rates[check] * 100)}%` };
  });

  console.log(`\n=== ${title} (${cases.length} cases) ===`);
  console.table(rows);
  return rates;
}

/** Writes the full run to evals/results/ (git-ignored) and returns the path. */
export function saveResults(name: string, payload: unknown): string {
  const dir = join('evals', 'results');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = join(dir, `${name}-${stamp}.json`);
  writeFileSync(file, JSON.stringify(payload, null, 2) + '\n');
  return file;
}

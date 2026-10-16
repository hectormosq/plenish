// Builds evals/datasets/logging.local.json from the session logs in logs/.
// The output holds real meal descriptions, so it is git-ignored.
// Usage: node evals/build-dataset.mjs

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const LOGS_DIR = 'logs';
const OUT_FILE = join('evals', 'datasets', 'logging.local.json');

if (!existsSync(LOGS_DIR)) {
  console.error(`No ${LOGS_DIR}/ directory found — nothing to build.`);
  process.exit(1);
}

// USER_MESSAGE  | text="..." | context={...} | +123ms   (text may span lines and may be unquoted)
const USER_MESSAGE = /^USER_MESSAGE\s+\| text=("?)([\s\S]*?)\1 \| context=(\{.*?\}) \| \+\d+ms$/gm;

const seen = new Set();
const cases = [];

for (const file of readdirSync(LOGS_DIR).filter((f) => f.endsWith('.txt')).sort()) {
  const content = readFileSync(join(LOGS_DIR, file), 'utf8').replace(/\r\n/g, '\n');
  for (const match of content.matchAll(USER_MESSAGE)) {
    const text = match[2].trim();
    let context;
    try {
      context = JSON.parse(match[3]);
    } catch {
      continue;
    }
    if (!text || !context.mealType || !context.date) continue;

    const key = `${text.toLowerCase()}|${context.mealType}|${context.date}`;
    if (seen.has(key)) continue;
    seen.add(key);

    cases.push({
      id: `log-${String(cases.length + 1).padStart(3, '0')}`,
      text,
      mealType: context.mealType,
      date: context.date,
      shareState: context.shareState ?? 'just-me',
      source: file,
    });
  }
}

writeFileSync(OUT_FILE, JSON.stringify(cases, null, 2) + '\n');
console.log(`Wrote ${cases.length} cases to ${OUT_FILE}`);

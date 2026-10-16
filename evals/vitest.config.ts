import path from 'node:path';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

// Run from the repo root: npm run eval
const root = process.cwd();

export default defineConfig({
  root,
  resolve: {
    alias: { '@': path.join(root, 'src') },
  },
  test: {
    environment: 'node',
    include: ['evals/**/*.eval.ts'],
    testTimeout: 900_000,
    env: {
      // Loads .env and .env.local so the provider API key is available.
      ...loadEnv('', root, ''),
      PLENISH_AI_PROVIDER: process.env.EVAL_PROVIDER ?? 'openai',
    },
  },
});

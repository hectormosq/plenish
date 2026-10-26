import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Unit tests: npm run test. Evals have their own config (evals/vitest.config.ts).
const root = process.cwd();

export default defineConfig({
  root,
  resolve: {
    alias: { '@': path.join(root, 'src') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});

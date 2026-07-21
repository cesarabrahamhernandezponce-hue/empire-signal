import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Mirror the tsconfig "@/*" → "./src/*" path alias so route handlers (which use
// the alias) can be imported and mocked in tests.
export default defineConfig({
  test: {
    // Explicit: suite runs in Node. Tests that need browser globals
    // (e.g. localStorage) stub them locally rather than pulling in jsdom.
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});

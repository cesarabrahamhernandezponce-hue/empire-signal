import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Mirror the tsconfig "@/*" → "./src/*" path alias so route handlers (which use
// the alias) can be imported and mocked in tests.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});

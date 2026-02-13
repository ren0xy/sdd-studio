import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.property.test.ts', 'tests/**/*.test.ts', 'tests/**/*.property.test.ts', 'deps/**/tests/**/*.test.ts', 'deps/**/tests/**/*.property.test.ts'],
    globals: true,
  },
});

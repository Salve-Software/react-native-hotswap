import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit',
    include: ['cli/src/**/__tests__/**/*.test.js'],
    environment: 'node',
  },
});

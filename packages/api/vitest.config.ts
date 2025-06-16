import { defineConfig } from 'vitest/config';
import { join } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    include: [
      '**/*.{test,spec}.?(c|m)[jt]s?(x)',
      'test/**/*.e2e-spec.ts'
    ],
  },
  resolve: {
    alias: {
      '@': join(__dirname, 'src'),
    },
  },
});
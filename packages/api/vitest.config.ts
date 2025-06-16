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
  esbuild: false, // Disable esbuild
  plugins: [
    {
      name: 'swc',
      transform(code, id) {
        if (id.endsWith('.ts') || id.endsWith('.tsx')) {
          const swc = require('@swc/core');
          return swc.transformSync(code, {
            filename: id,
            jsc: {
              parser: {
                syntax: 'typescript',
                decorators: true,
              },
              transform: {
                legacyDecorator: true,
                decoratorMetadata: true,
              },
              target: 'es2022',
            },
            module: {
              type: 'commonjs',
            },
          });
        }
      },
    },
  ],
  resolve: {
    alias: {
      '@': join(__dirname, 'src'),
    },
  },
});
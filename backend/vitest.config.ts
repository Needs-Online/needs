import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/modules': path.resolve(__dirname, './src/modules'),
      '@/common': path.resolve(__dirname, './src/common'),
      '@/config': path.resolve(__dirname, './src/config'),
      '@/infra': path.resolve(__dirname, './src/infra'),
      '@/database': path.resolve(__dirname, './src/database'),
      '@/lib': path.resolve(__dirname, './src/lib'),
      '@/realtime': path.resolve(__dirname, './src/realtime'),
      '@/workers': path.resolve(__dirname, './workers'),
    },
  },
});

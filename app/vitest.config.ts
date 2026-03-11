import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/test-setup.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/**/index.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@core': resolve(__dirname, 'src/core'),
      '@board-ui': resolve(__dirname, 'src/board-ui'),
      '@game-engine': resolve(__dirname, 'src/game-engine'),
      '@rules-engine': resolve(__dirname, 'src/rules-engine'),
      '@katago-bridge': resolve(__dirname, 'src/katago-bridge'),
      '@explanation-engine': resolve(__dirname, 'src/explanation-engine'),
      '@gamification': resolve(__dirname, 'src/gamification'),
      '@analytics': resolve(__dirname, 'src/analytics'),
      '@settings': resolve(__dirname, 'src/settings'),
      '@i18n': resolve(__dirname, 'src/i18n'),
      '@features': resolve(__dirname, 'src/features'),
    },
  },
})

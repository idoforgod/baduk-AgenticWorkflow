import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [tailwindcss(), react()],

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

  // Vite options tailored for Tauri development
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ['**/src-tauri/**'],
    },
  },
}))

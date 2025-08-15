// app/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Polyfill the web‐crypto API for Vite's SSR plugins
// ;(globalThis as any).crypto = webcrypto

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), './src')
    },
  },
  base: '/',
})
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}', 'server/**/*.test.js'],
    setupFiles: ['./vitest.setup.js'],
    environmentOptions: { jsdom: { url: 'http://localhost:5173' } },
  },
})
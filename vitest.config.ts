import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// Unit + architecture + backend tests. Component tests opt into jsdom with a
// `// @vitest-environment jsdom` docblock; everything else runs in node so the
// deterministic rules engine is tested without a DOM.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@domain': fileURLToPath(new URL('./src/domain', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: [
      'src/**/*.test.{ts,tsx}',
      'tests/unit/**/*.test.ts',
      'tests/architecture/**/*.test.ts',
      'backend/src/**/*.test.ts',
    ],
    exclude: ['node_modules', 'dist', 'dist-e2e', 'backend/dist', 'tests/e2e/**'],
    setupFiles: ['./tests/setup.ts'],
    restoreMocks: true,
  },
})

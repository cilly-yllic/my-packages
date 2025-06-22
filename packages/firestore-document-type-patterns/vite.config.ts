import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/firestore-document-type-patterns',
  plugins: [],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },
  resolve: {
    alias: {
      '~root': resolve(__dirname, './src/lib'),
      '~internal': resolve(__dirname, './src/lib/_internal'),
      '~types': resolve(__dirname, './src/lib/_internal/types'),
      '~utils': resolve(__dirname, './src/lib/_internal/utils'),
    },
  },
  test: {
    passWithNoTests: true,
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}))

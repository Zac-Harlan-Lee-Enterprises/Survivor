import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'

export default defineConfig([
  globalIgnores([
    'dist',
    'dist-e2e',
    'backend/dist',
    'node_modules',
    'coverage',
    'playwright-report',
    'test-results',
  ]),
  {
    files: ['**/*.{ts,tsx,mts}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat['recommended-latest'],
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // console.log is a debug artifact; warn/error are legitimate diagnostics.
      'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Node-side scripts and tests may log freely; they are tooling, not the app.
    files: ['scripts/**/*.{mjs,ts,mts}', 'tests/**/*.ts', 'build/**/*.ts', 'backend/src/**/*.ts'],
    rules: { 'no-console': 'off', 'react-refresh/only-export-components': 'off' },
  },
  {
    files: ['scripts/**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: { ...globals.node } },
  },
])

import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'playwright-report/**', 'test-results/**', 'security/review-rules.jsx'] },
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } } },
    rules: { ...js.configs.recommended.rules, 'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z]', argsIgnorePattern: '^_' }] },
  },
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: { ...reactHooks.configs['recommended-latest'].rules, 'react-refresh/only-export-components': ['warn', { allowConstantExport: true, allowExportNames: ['categoryLabels'] }] },
  },
  { files: ['api/**/*.js', 'server/**/*.js', 'tests/**/*.mjs', '*.{js,mjs}'], languageOptions: { globals: globals.node } },
  { files: ['tests/browser/**/*.js', 'vitest.setup.js'], languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  { files: ['src/**/*.test.{js,jsx}'], languageOptions: { globals: globals.vitest } },
];

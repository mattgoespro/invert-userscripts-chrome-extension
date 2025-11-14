import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        chrome: 'readonly',
        console: 'readonly',
        document: 'readonly',
        window: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        Promise: 'readonly',
        Element: 'readonly',
        HTMLElement: 'readonly',
        HTMLButtonElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLVideoElement: 'readonly',
        MutationObserver: 'readonly',
        localStorage: 'readonly',
        alert: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
];

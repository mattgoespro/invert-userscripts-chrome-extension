import html from '@html-eslint/eslint-plugin';
import react from 'eslint-plugin-react';
import defineConfig from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: ['temp', 'node_modules', 'out', 'dist'],
  },
  {
    ...react.configs.flat.recommended,
    files: ['src/renderer/**/*.ts', 'src/renderer/**/*.tsx'],
    settings: {
      react: {
        version: 'detect',
      },
      ecmaFeatures: {
        jsx: true,
        modules: true,
      },
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
    },
  },
  html.configs['flat/recommended'],
  tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'src/**/*.tsx', 'scripts/**/*.ts', 'tools/**/*.ts', '*.ts', '*.mts'],
    rules: {
      'no-unused-vars': 'off',
      'no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  }
);

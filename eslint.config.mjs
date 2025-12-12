import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

function configureTsEslintConfig(rootDir, files) {
  return {
    files,
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: rootDir,
      },
    },
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
  };
}

export const base = {
  config: defineConfig(
    {
      ignores: ['temp', 'node_modules', 'out', 'dist'],
    },
    tseslint.configs.recommended,
    configureTsEslintConfig(import.meta.dirname, ['**/*.ts'])
  ),
  configureTsEslintConfig,
};

export default base.config;

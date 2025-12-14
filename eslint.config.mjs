import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

/** @type { (rootDir: string, files: string[]) => import("eslint").Linter.Config } */
function configureTsEslintConfig(rootDir, files) {
  return {
    files,
    ignores: ['**/node_modules/**', '**/dist/**'],
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
      ignores: ['**/node_modules/**', '**/dist/**'],
    },
    tseslint.configs.recommended,
    configureTsEslintConfig(import.meta.dirname, ['**/*.ts'])
  ),
  configureTsEslintConfig,
};

export default base.config;

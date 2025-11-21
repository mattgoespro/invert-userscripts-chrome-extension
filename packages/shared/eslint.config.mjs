import { defineConfig } from 'eslint/config';
import base from '../../eslint.config.mjs';

export default defineConfig(
  base.config,
  base.configureTsEslintConfig(import.meta.dirname, ['**/*.ts'])
);

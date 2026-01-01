import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

/** @type { (rootDir: string, files: string[]) => import("eslint").Linter.Config } */
function configureTsEslintConfig(rootDir, files) {
  return {
    files,
    ignores: ["**/node_modules/**", "**/dist/**"],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: rootDir,
      },
    },
    rules: {
      "no-unused-vars": "off",
      "no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  };
}

const common = defineConfig(
  {
    ignores: ["**/node_modules/**", "**/dist/**"],
  },
  tseslint.configs.recommended
);

const config = defineConfig(...common, configureTsEslintConfig(import.meta.dirname, ["**/*.ts"]));

export const base = {
  common,
  configureTsEslintConfig,
};

export default config;

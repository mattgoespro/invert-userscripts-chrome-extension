import html from "@html-eslint/eslint-plugin";
import react from "eslint-plugin-react";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import { base } from "../../eslint.config.mjs";

export default defineConfig(
  ...base.common,
  {
    ...react.configs.flat.recommended,
    files: ["src/renderer/**/*.ts", "src/renderer/**/*.tsx"],
    settings: {
      react: {
        version: "detect",
      },
      ecmaFeatures: {
        jsx: true,
        modules: true,
      },
    },
    rules: {
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",
    },
  },
  html.configs["flat/recommended"],
  tseslint.configs.recommended,
  base.configureTsEslintConfig(import.meta.dirname, ["**/*.ts", "**/*.tsx"])
);

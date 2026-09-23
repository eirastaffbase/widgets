// @ts-check

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  // Global ignores must be their own config object — listing `ignores` alongside
  // `files` only scopes them to that block, which lets the built bundle in
  // dist/ get linted.
  { ignores: ["node_modules/**", "coverage/**", "dist/**"] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["node_modules", "coverage", "dist"],
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
);

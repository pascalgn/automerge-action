import js from "@eslint/js";
import jest from "eslint-plugin-jest";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2017,
        sourceType: "module"
      },
      globals: {
        ...globals.node,
        ...globals.es2015,
        ...globals.jest
      }
    },
    plugins: { jest },
    rules: {
      semi: "error",
      "no-tabs": "error",
      "no-console": "off"
    }
  },
  {
    ignores: ["eslint.config.mjs", "dist/*"]
  }
];

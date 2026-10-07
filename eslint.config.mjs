import tsParser from "@typescript-eslint/parser";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  { ignores: ["node_modules/**", ".next/**", "Backend/data/**", "next-env.d.ts"] },
  {
    files: ["**/*.js", "**/*.mjs", "**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node, ...globals.browser },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "no-debugger": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-unreachable": "error",
      "no-constant-condition": "error",
      "no-duplicate-case": "error",
      "no-dupe-args": "error",
      "no-dupe-keys": "error",
      "no-eval": "error",
      "no-new-func": "error",
      "no-unsafe-finally": "error",
      "valid-typeof": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],
    },
  },
];

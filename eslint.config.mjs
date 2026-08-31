import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "dist-electron/**", "release/**", "node_modules/**", "app/**", "lib/**", "db/**", "worker/**", "examples/**", "build/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ["src/**/*.{ts,tsx}"], languageOptions: { globals: globals.browser } },
  { files: ["electron/**/*.{ts,cts}", "scripts/**/*.{js,mjs,cjs}", "vite.config.ts"], languageOptions: { globals: globals.node } },
  { files: ["electron/**/*.cts", "scripts/**/*.cjs"], rules: { "@typescript-eslint/no-require-imports": "off" } },
);

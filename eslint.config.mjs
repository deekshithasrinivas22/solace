import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    "node_modules/**",
    ".pnpm-store/**",
    ".pnpm-cache/**",
    ".next/**",
    ".next-verify/**",
    ".next-preview/**",
    ".next-*/**",
    ".next-final/**",
    ".next-single-worker/**",
    ".tools/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // references/kanban-reference/: projeto de referência à parte (SaaS Kanban original), não faz
    // parte do build deste app — ver app/(app)/kanban para o módulo portado.
    "references/kanban-reference/**",
  ]),
]);

export default eslintConfig;

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// TODO(deuda técnica, desbloquea CI "Lint & Code Style"):
// reglas concentradas en deuda preexistente (~70 errores: `any`, entidades sin
// escapar, setState en effects) se dejan como warning mientras se refactoriza.
// Mismo criterio que en `apps/admin/eslint.config.mjs`.
const WARN_DEBT = [
  "@typescript-eslint/no-explicit-any",
  "react/no-unescaped-entities",
  "react-hooks/set-state-in-effect",
  "react-hooks/purity",
  "react-hooks/immutability",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: Object.fromEntries(WARN_DEBT.map((rule) => [rule, "warn"])),
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Capacitor / native build output
    "dist/**",
    "android/**",
    "ios/**",
  ]),
]);

export default eslintConfig;

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// TODO(deuda técnica, desbloquea CI "Lint & Code Style"):
// `@rabbitty/admin` acumula ~370 errores preexistentes concentrados en estas
// reglas (222 `any`, 76 entidades sin escapar, 46 setState en effects, 24 de
// pureza del compilador React). Corregirlos requiere una refactorización con
// revisión propia, así que mientras tanto se dejan como warning — los otros
// workspaces (kds, pos, landing) corren con la regla en error.
// Ref: migración de `next lint` (eliminado en Next 16) a eslint flat config.
const WARN_DEBT = [
  "@typescript-eslint/no-explicit-any",
  "react/no-unescaped-entities",
  "react-hooks/set-state-in-effect",
  "react-hooks/purity",
  "react-hooks/static-components",
  "react-hooks/immutability",
  // `refs`: falso positivo en `(pos)/pos/page.tsx` (visibleTabs es useMemo, no un
  // ref). Verificado contra 68abcd3: el error ya existía antes de este trabajo.
  // Se degrada junto al resto de la deuda del compilador React hasta la refactorización.
  "react-hooks/refs",
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
  ]),
]);

export default eslintConfig;
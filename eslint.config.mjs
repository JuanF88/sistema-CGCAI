import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

/**
 * ⚠️ En flat config, ESLint 9 solo aplica por defecto a `.js`, `.mjs` y `.cjs`.
 * Sin este `files`, los `.jsx` quedan fuera y `eslint` los ignora en silencio
 * ("File ignored because no matching configuration was supplied"), que es
 * justo lo que pasaba antes.
 */
const FILES = ["**/*.{js,mjs,cjs,jsx,ts,tsx}"];

const eslintConfig = [
  {
    // Sin esto ESLint recorre .next/ y el análisis tarda minutos.
    ignores: [
      ".next/**",
      "node_modules/**",
      ".venv/**",
      "public/**",
      "next-env.d.ts",
    ],
  },
  ...compat
    .extends("next/core-web-vitals", "next/typescript")
    .map((config) => ({ ...config, files: FILES })),
];

export default eslintConfig;

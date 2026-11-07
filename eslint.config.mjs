import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // BACKLOG TEKNIS (bukan bug runtime): respons API Orbisway belum punya
      // tipe lengkap, sehingga ratusan `any` dipakai di route/halaman booking.
      // Dijadikan warning agar CI tidak merah; kurangi bertahap dengan menambah
      // tipe di lib/orbis-types.ts. Jangan refactor massal tanpa uji ke sandbox
      // Orbisway.
      "@typescript-eslint/no-explicit-any": "warn",
      // Variabel/argumen berawalan `_` sengaja tidak dipakai.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      // Aturan baru React Compiler (eslint-plugin-react-hooks v7): pola
      // fetch-di-effect & ref pada halaman yang sudah berjalan ditandai sebagai
      // warning. Perbaiki per halaman bersama pengujian UI, jangan sekaligus.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
    },
  },
  globalIgnores([
    ".next/**",
    "**/.kilo/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

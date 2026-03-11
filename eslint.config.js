import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import security from "eslint-plugin-security";

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      "dist/",
      "node_modules/",
      "coverage/",
      "src/web/dashboard/",
      "**/*.js",
      "**/*.mjs",
      "**/*.cjs",
    ],
  },

  // Base JS recommended rules
  eslint.configs.recommended,

  // TypeScript strict rules
  ...tseslint.configs.strict,

  // Security plugin
  security.configs.recommended,

  // Project-specific overrides
  {
    files: ["src/**/*.ts"],
    rules: {
      // Enforce logger usage over console
      "no-console": "warn",

      // Allow underscore-prefixed unused vars (common pattern for Express middleware, destructuring)
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],

      // TypeScript strict
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "warn",

      // Security plugin adjustments for local-first project
      "security/detect-object-injection": "off",
      "security/detect-non-literal-fs-filename": "off",
      "security/detect-non-literal-regexp": "warn",
    },
  },

  // Logger file — must use console (it IS the console wrapper)
  {
    files: ["src/core/utils/logger.ts"],
    rules: {
      "no-console": "off",
    },
  },

  // Test files — relaxed rules
  {
    files: ["src/tests/**/*.ts"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "security/detect-object-injection": "off",
    },
  },
);

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/tests/**/*.test.ts"],
    globals: true,
    coverage: {
      provider: "v8",
      include: ["src/core/**", "src/api/**", "src/mcp/**", "src/cli/**"],
      exclude: ["src/tests/**"],
      reporter: ["text", "html", "lcov"],
      thresholds: {
        statements: 70,
        branches: 65,
        functions: 70,
        lines: 70,
      },
    },
  },
});

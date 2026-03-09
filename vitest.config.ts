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
    },
  },
});

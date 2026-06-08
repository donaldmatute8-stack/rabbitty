import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.test.ts", "**/*.integration.test.ts"],
    setupFiles: [],
    env: {
      RESTAURANT_DATABASE_URL: "postgres://rabbitty:rabbitty_dev@localhost:5432/rabbitty_restaurant",
      CORE_DATABASE_URL: "postgres://rabbitty:rabbitty_dev@localhost:5432/rabbitty_core",
      BRANCH_ID: "b1",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["**/node_modules/**", "**/*.d.ts", "**/dist/**"],
    },
  },
});

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  timeout: 30000,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev:pos",
    cwd: "/Users/bullslab/.openclaw/agents/sofia-workspace/projects/Rabbitty",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
    env: {
      E2E_TEST: "true",
      BRANCH_ID: "b1",
      NEXT_PUBLIC_BRANCH_ID: "b1",
      AUTH_SECRET: "test-auth-secret-for-e2e-at-least-32-chars!!",
    },
  },
});

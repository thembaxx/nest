import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  use: { baseURL: process.env.BASE_URL || "http://localhost:3000", headless: true },
  reporter: "list",
  timeout: 45000,
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "pnpm start",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
      },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    {
      name: "webkit",
      testMatch: "**/{page-edges,sync-data,sync-backup}.spec.ts",
      use: { browserName: "webkit" },
    },
  ],
});

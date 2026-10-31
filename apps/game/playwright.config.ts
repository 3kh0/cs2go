import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:5173",
    viewport: { width: 1440, height: 900 },
    channel: "chromium",
  },
  webServer: [
    {
      command: "bun run dev --host 127.0.0.1",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: true,
    },
    {
      command: "bun ../server/tests/browser-server.ts",
      url: "http://127.0.0.1:3002/healthz",
      env: { PORT: "3002", ALLOWED_ORIGINS: "http://127.0.0.1:5173,http://127.0.0.1:5183" },
      reuseExistingServer: false,
    },
  ],
});

import { defineConfig } from "@playwright/test";
/** Run against a completed production build; development has no service worker. */
export default defineConfig({
  testDir: "./startup-tests",
  testMatch: "startup.spec.ts",
  workers: 1,
  timeout: 180000,
  outputDir: "../../artifacts/startup-tests",
  use: {
    baseURL: "http://127.0.0.1:5185",
    channel: "chromium",
    reducedMotion: "reduce",
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: "bun run preview --host 127.0.0.1 --port 5185",
    url: "http://127.0.0.1:5185",
    reuseExistingServer: false,
  },
});

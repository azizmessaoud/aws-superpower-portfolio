import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  reporter: [["list"]],
  use: { baseURL: "http://127.0.0.1:4173" },
  webServer: { command: "npm run preview", url: "http://127.0.0.1:4173", reuseExistingServer: true, timeout: 60_000 },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 860 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 860 }, hasTouch: true, isMobile: true } },
  ],
});

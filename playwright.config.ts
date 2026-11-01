import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  workers: 2, /* software WebGL is CPU-bound: more workers only starve each other's animation loops */
  reporter: [["list"]],
  /* software WebGL, so the 3D hero can run in a headless browser with no GPU (slow, but real WebGL2) */
  use: { baseURL: "http://127.0.0.1:4173", launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] } },
  webServer: { command: "npm run preview", url: "http://127.0.0.1:4173", reuseExistingServer: true, timeout: 60_000 },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 860 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 860 }, hasTouch: true, isMobile: true } },
  ],
});

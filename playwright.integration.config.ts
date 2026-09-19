import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e", testMatch: ["onboarding-integration.spec.ts", "password-reset.spec.ts"],
  use: { baseURL: "http://127.0.0.1:5176", trace: "retain-on-failure" },
  webServer: {
    command: "node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5176 --strictPort",
    env: { VITE_DEV_AUTH_TOKEN: "isolated-admin-test", VITE_API_BASE_URL: "http://127.0.0.1:8000/api/v1" },
    port: 5176, reuseExistingServer: false,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "tablet", use: { ...devices["Desktop Chrome"], viewport: { width: 820, height: 1180 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});

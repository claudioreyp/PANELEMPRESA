import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://127.0.0.1:5174", trace: "on-first-retry" },
  webServer: {
    command: "node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5174",
    port: 5174,
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }],
});

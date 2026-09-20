import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://127.0.0.1:5184", trace: "on-first-retry" },
  webServer: {
    command: "node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5184 --strictPort",
    port: 5184,
    reuseExistingServer: false,
    env: {
      VITE_API_BASE_URL: "http://127.0.0.1:8000/api/v1",
      VITE_DEV_AUTH_TOKEN: "isolated-browser-test",
      VITE_SUPABASE_URL: "",
      VITE_SUPABASE_ANON_KEY: "",
    },
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }],
});

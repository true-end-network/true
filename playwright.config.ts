import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  retries: 1,
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  webServer: {
    command: "NEXT_PUBLIC_RELAY_URL=ws://localhost:3001 npm run dev:all",
    port: 3000,
    reuseExistingServer: true,
    timeout: 30000,
  },
})

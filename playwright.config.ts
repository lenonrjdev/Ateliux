import { defineConfig, devices } from "@playwright/test";
import { getE2EEnv, loadE2EEnvFiles } from "./e2e/helpers/env";

loadE2EEnvFiles();

const env = getE2EEnv();
const shouldStartServers = process.env.E2E_START_SERVERS === "true";
const shouldStartBackendServer = shouldStartServers && process.env.E2E_START_BACKEND_SERVER !== "false";
const webServerTimeout = 180_000;

export default defineConfig({
  testDir: "./e2e",
  timeout: 180_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: env.frontendUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: shouldStartServers
    ? [
        ...(shouldStartBackendServer
          ? [
              {
                command: "npm run start:dev",
                cwd: "./backend",
                url: `${env.apiUrl}health`,
                reuseExistingServer: true,
                timeout: webServerTimeout,
              },
            ]
          : []),
        {
          command: "npm run dev -- -p 3002",
          cwd: "./admin",
          url: env.adminUrl,
          reuseExistingServer: true,
          timeout: webServerTimeout,
        },
        {
          command: "npm run dev",
          cwd: "./frontend",
          url: env.frontendUrl,
          reuseExistingServer: true,
          timeout: webServerTimeout,
        },
      ]
    : undefined,
});

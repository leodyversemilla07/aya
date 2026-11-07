import { defineConfig, devices } from '@playwright/test';

const API_URL = 'http://localhost:3001';
const WEB_URL = 'http://localhost:3000';

const sharedEnv: Record<string, string> = {
  DATABASE_URL: 'file:./playwright.db',
  BETTER_AUTH_SECRET: 'playwright-better-auth-secret-at-least-32-chars',
  BETTER_AUTH_URL: WEB_URL,
  NEXT_PUBLIC_API_URL: API_URL,
  API_KEY: 'playwright-api-key',
  CORS_ORIGINS: WEB_URL,
  LLM_API_KEY: 'playwright-llm-key',
  SEED_FORCE: 'true',
};

function inheritedEnv(overrides: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = value;
  }
  return { ...env, ...sharedEnv, ...overrides };
}

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: process.env.CI ? 1 : undefined,
  retries: process.env.CI ? 2 : 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  outputDir: './test-results',
  use: {
    baseURL: WEB_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @aya/api run start',
      url: `${API_URL}/health`,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      env: inheritedEnv({ API_PORT: '3001' }),
    },
    {
      command: 'pnpm --filter web run start',
      url: `${WEB_URL}/sign-in`,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      env: inheritedEnv({ PORT: '3000' }),
    },
  ],
});

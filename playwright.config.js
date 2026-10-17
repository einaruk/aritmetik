import { defineConfig, devices } from '@playwright/test';

const mini = devices['iPhone 12 Mini'];
// Ana ekrana eklenmiş (standalone) uygulamada Safari çubukları yok: 375 × 812,
// üstte 50, altta 34 px güvenli alan.
const standalone = { ...mini, viewport: { width: 375, height: 812 } };

// Yerelde WebKit sistem kütüphaneleri eksikse: E2E_BROWSERS=chromium npm run test:e2e
const browsers = (process.env.E2E_BROWSERS || 'webkit,chromium').split(',');

const projects = [];
for (const browserName of browsers) {
  projects.push({ name: `${browserName}-iphone12mini-safari`, use: { ...mini, browserName } });
  projects.push({ name: `${browserName}-iphone12mini-standalone`, use: { ...standalone, browserName } });
}

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:4799/', trace: 'retain-on-failure' },
  webServer: { command: 'node tools/serve.js 4799', url: 'http://localhost:4799/', reuseExistingServer: false },
  projects,
});

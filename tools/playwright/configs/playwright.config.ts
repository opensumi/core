import path from 'path';

import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  testDir: '../lib/tests',
  testMatch: ['**/*.js'],
  workers: 2,
  timeout: 60 * 1000,
  use: {
    baseURL: 'http://localhost:8080',
    browserName: 'chromium',
    screenshot: 'only-on-failure',
    viewport: { width: 1920, height: 1080 },
  },
  snapshotDir: path.join(__dirname, '../src/tests/snapshots'),
  expect: {
    toMatchSnapshot: { threshold: 0.15 },
  },
  preserveOutput: 'failures-only',
  reporter: [['list'], ['allure-playwright']],
};

export default config;

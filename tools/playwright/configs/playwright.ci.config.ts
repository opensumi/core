import { PlaywrightTestConfig } from '@playwright/test';

import baseConfig from './playwright.config';

const ciConfig: PlaywrightTestConfig = {
  ...baseConfig,
  workers: 1,
  retries: 5,
  maxFailures: process.env.CI ? 10 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
};

export default ciConfig;

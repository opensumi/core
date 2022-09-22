import { PlaywrightTestConfig } from '@playwright/test';

import baseConfig from './playwright.config';

const ciConfig: PlaywrightTestConfig = {
  ...baseConfig,
  workers: 1,
  retries: 1,
  maxFailures: process.env.CI ? 10 : undefined,
};

export default ciConfig;

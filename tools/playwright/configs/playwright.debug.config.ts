import { PlaywrightTestConfig } from '@playwright/test';

import baseConfig from './playwright.config';

const headfulConfig: PlaywrightTestConfig = {
  ...baseConfig,
  workers: 1,
  timeout: 10 * 1000 * 60,
};

export default headfulConfig;

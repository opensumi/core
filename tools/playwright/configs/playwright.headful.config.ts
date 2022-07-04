import { PlaywrightTestConfig } from '@playwright/test';

import baseConfig from './playwright.config';

const headfulConfig: PlaywrightTestConfig = {
  ...baseConfig,
  workers: 1,
  use: {
    ...baseConfig.use,
    headless: false,
  },
};

export default headfulConfig;

import { expect } from '@playwright/test';

import { OpenSumiApp } from '../app';

import test, { page } from './hooks';

test.describe('Application', () => {
  test('should show main layout', async () => {
    const app = await OpenSumiApp.load(page);
    expect(await app.isMainLayoutVisible()).toBe(true);
  });
});

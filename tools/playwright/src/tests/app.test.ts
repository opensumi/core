import path from 'path';

import { expect } from '@playwright/test';

import { OpenSumiApp } from '../app';
import { OpenSumiWorkspace } from '../workspace';

import test, { page } from './hooks';

test.describe('Application', () => {
  test('should show main layout', async () => {
    const workspace = new OpenSumiWorkspace([path.resolve('./src/tests/workspaces/default')]);
    const app = await OpenSumiApp.load(page, workspace);
    expect(await app.isMainLayoutVisible()).toBe(false);
  });
});

import path from 'path';

import { expect } from '@playwright/test';

import { OpenSumiApp } from '..';
import { OpenSumiSearchView } from '../search-view';
import { OpenSumiWorkspace } from '../workspace';

import test, { page } from './hooks';

let app: OpenSumiApp;
let search: OpenSumiSearchView;

test.describe('OpenSumi Search Panel', () => {
  test.beforeAll(async () => {
    const workspace = new OpenSumiWorkspace([path.resolve('./src/tests/workspaces/default')]);
    app = await OpenSumiApp.load(page, workspace);
    search = await app.open(OpenSumiSearchView);
  });

  test('Can search files by simple text', () => {
    expect(search.isVisible()).toBeTruthy();
  });
});

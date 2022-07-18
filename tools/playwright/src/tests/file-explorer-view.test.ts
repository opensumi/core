import { expect } from '@playwright/test';

import { OpenSumiApp } from '..';
import { OpenSumiExplorerView } from '../explorer-view';

import test, { page } from './hooks';

let app: OpenSumiApp;
let explorer: OpenSumiExplorerView;

test.describe('OpenSumi Explorer Panel', () => {
  test.beforeAll(async () => {
    app = await OpenSumiApp.load(page);
    explorer = await app.open(OpenSumiExplorerView);
  });

  test('[FileTree] should show filetree explorer', () => {
    expect(explorer.isVisible()).toBeTruthy();
  });

  // test.describe('OpenedEditor Explorer View', () => {

  // });

  // test.describe('Outline Explorer View', () => {

  // });
});

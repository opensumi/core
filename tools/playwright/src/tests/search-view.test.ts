import { expect } from '@playwright/test';

import { OpenSumiApp } from '..';
import { OpenSumiSearchView } from '../search-view';

import test, { page } from './hooks';

let app: OpenSumiApp;
let search: OpenSumiSearchView;

test.describe('OpenSumi Search Panel', () => {
  test.beforeAll(async () => {
    app = await OpenSumiApp.load(page);
    search = await app.open(OpenSumiSearchView);
  });

  test('Can search files by simple text', () => {
    expect(search.isVisible()).toBeTruthy();
  });
});

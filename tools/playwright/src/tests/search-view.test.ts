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

  test('Can search files by simple text', async () => {
    const searchText = 'hello';
    expect(await search.isVisible()).toBeTruthy();
    await search.focusOnSearch();
    await page.keyboard.type(searchText);
    // search panel should searched after typing
    await app.page.keyboard.press('Enter');
    const { results, files } = await search.getSearchResult();
    expect(results).toBe(1);
    expect(files).toBe(1);
  });
});

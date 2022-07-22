import test, { Page } from '@playwright/test';

export let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
});

export default test;

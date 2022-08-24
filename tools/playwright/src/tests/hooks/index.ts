import test, { Page } from '@playwright/test';

export let page: Page;

test.beforeAll(async ({ browser }) => {
  // ref: https://playwright.dev/docs/api/class-browsercontext
  const context = await browser.newContext({
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  page = await context.newPage();
});

export default test;

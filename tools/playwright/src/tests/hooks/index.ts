import test, { Browser, BrowserContext, Page } from '@playwright/test';

export let page: Page;
let context: BrowserContext;

export async function resetPage(browser: Browser): Promise<Page> {
  await context?.close();
  context = await browser.newContext({
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  page = await context.newPage();
  return page;
}

test.beforeAll(async ({ browser }) => {
  // ref: https://playwright.dev/docs/api/class-browsercontext
  await resetPage(browser);
});

export default test;

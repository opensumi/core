import test, { Browser, BrowserContext, Page } from '@playwright/test';

export let page: Page;
let context: BrowserContext;
let capturedBrowser: Browser | undefined;

export async function resetPage(browser: Browser): Promise<Page> {
  await context?.close();
  context = await browser.newContext({
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  page = await context.newPage();
  return page;
}

test.beforeAll(async ({ browser }) => {
  // Playwright evaluates this module once per worker and attaches top-level
  // hooks to the FIRST spec file that imports it. Spec files loaded after that
  // never run this hook again, so they must heal a dead shared page themselves
  // via ensurePage() (see acp-bdd-fixture).
  capturedBrowser = browser;
  await resetPage(browser);
});

/**
 * Returns a live page for the current worker, resetting the shared context when
 * the page left by a previous spec file was closed (its hooks-level afterAll
 * only ever ran for the first file in the invocation).
 */
export async function ensurePage(): Promise<Page> {
  if (!page || page.isClosed()) {
    if (!capturedBrowser) {
      throw new Error('Page fixture used before the hooks beforeAll provisioned a browser.');
    }
    return resetPage(capturedBrowser);
  }
  return page;
}

export default test;

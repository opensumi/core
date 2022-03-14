/**
 * Terminal Package Render Case Test
 */

import * as puppeteer from 'puppeteer';

import { getTerminalControllerState, selectTabIndex, isFocusedClientRenderedAndFit } from './utils';

const APP = 'http://0.0.0.0:8080';

let browser: puppeteer.Browser;
let page: puppeteer.Page;
const width = 800;
const height = 600;

describe('Terminal Render', (): void => {
  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: process.argv.indexOf('--headless') !== -1,
      args: [`--window-size=${width},${height}`, '--no-sandbox'],
    });
    page = (await browser.pages())[0];
    await page.setViewport({ width, height });
  });

  beforeEach((done) => {
    page.goto(APP);
    const interval = setInterval(async () => {
      const res = await page.evaluate(`
        !!window.__commands__;
      `);
      if (res) {
        clearInterval(interval);
        done();
      }
    }, 200);
  });

  it('Add, Remove And Select Terminal', async () => {
    let state: { index: number; focus: boolean };
    (await page.evaluate(`
      window.__commands__.executeCommand('terminal.add');
    `)) as number;
    state = await getTerminalControllerState(page);
    expect(state.index === 2);

    (await page.evaluate(`
      window.__commands__.executeCommand('terminal.add');
    `)) as number;
    state = await getTerminalControllerState(page);
    expect(state.index === 3);

    (await page.evaluate(`
      window.__commands__.executeCommand('terminal.remove');
    `)) as number;
    state = await getTerminalControllerState(page);
    expect(state.index === 2);

    await selectTabIndex(page, 0);
    const isFit = await isFocusedClientRenderedAndFit(page);
    expect(isFit === true);
  });

  afterAll(() => browser.close());
});

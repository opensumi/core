import * as puppeteer from 'puppeteer';

const reaction = 200;

export function evalDelay(page: puppeteer.Page, fn: string, delay: number) {
  return new Promise((resolve) => {
    setTimeout(async () => {
      const res = page.evaluate(fn);
      resolve(res);
    }, delay);
  });
}

export async function getTerminalControllerState(page: puppeteer.Page): Promise<{ index: number; focus: boolean }> {
  return evalDelay(
    page,
    `
    window.__term_controller__.state;
  `,
    reaction,
  ) as any;
}

export async function getTabManagerState(page: puppeteer.Page): Promise<{ current: number }> {
  return evalDelay(
    page,
    `
    window.__tab_manager__.state;
  `,
    reaction,
  ) as any;
}

export async function getCurrentClientId(page: puppeteer.Page): Promise<string> {
  return evalDelay(
    page,
    `
    const controller = window.__term_controller__;
    controller.focusedTerm.id;
  `,
    reaction,
  ) as any;
}

export async function isFocusedClientRenderedAndFit(page: puppeteer.Page): Promise<boolean> {
  return evalDelay(
    page,
    `
    const controller = window.__term_controller__;
    !controller.focusedTerm.notReadyToShow;
  `,
    reaction,
  ) as any;
}

export async function selectTabIndex(page: puppeteer.Page, index: number) {
  return page.evaluate(`
    window.__tab_manager__.select(${index});
  `);
}

export async function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

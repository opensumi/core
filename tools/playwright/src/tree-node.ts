import { ElementHandle } from '@playwright/test';

import { OpenSumiApp } from './app';
import { OpenSumiContextMenu } from './context-menu';

export interface IOpenSumiTreeNodeSelector {
  labelClass: string;
  descriptionClass: string;
  badgeClass: string;
  toggleClass: string;
  selectedClass: string;
  focusedClass: string;
  collapsedClass: string;
}

export abstract class OpenSumiTreeNode {
  constructor(
    protected elementHandle: ElementHandle<SVGElement | HTMLElement>,
    protected app: OpenSumiApp,
    private selector: IOpenSumiTreeNodeSelector = {
      labelClass: "[class*='node_displayname__']",
      descriptionClass: "[class*='node_description__']",
      badgeClass: "[class*='node_status___']",
      toggleClass: "[class*='expansion_toggle__']",
      selectedClass: "[class*='mod_selected__']",
      focusedClass: "[class*='mod_focused__']",
      collapsedClass: "[class*='mod_collapsed__']",
    },
  ) {}

  async parentElementHandle() {
    const parent = await this.elementHandle.getProperty('parentNode');
    return parent.asElement();
  }

  private async getCurrentElementHandle(parent: ElementHandle | null, dataId: string | null) {
    if (!parent || !dataId) {
      return this.elementHandle;
    }

    const current = await parent.evaluateHandle(
      (parentElement: Element, id: string) =>
        Array.from(parentElement.querySelectorAll<HTMLElement>('[data-id]')).find(
          (item) => item.getAttribute('data-id') === id,
        ),
      dataId,
    );
    const currentElement = current.asElement();
    if (currentElement) {
      this.elementHandle = currentElement as ElementHandle<SVGElement | HTMLElement>;
    }

    return this.elementHandle;
  }

  private getDataIdSelector(dataId: string) {
    return `[data-id="${dataId.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;
  }

  private async waitForCollapsedState(collapsed: boolean, parent: ElementHandle | null, dataId: string | null) {
    if (!parent || !dataId) {
      const selector = collapsed
        ? this.selector.collapsedClass
        : `${this.selector.toggleClass}:not(${this.selector.collapsedClass})`;
      await this.elementHandle.waitForSelector(selector);
      return;
    }

    const nodeSelector = this.getDataIdSelector(dataId);
    const selector = collapsed
      ? `${nodeSelector} ${this.selector.collapsedClass}`
      : `${nodeSelector} ${this.selector.toggleClass}:not(${this.selector.collapsedClass})`;
    await parent.waitForSelector(selector, { timeout: 10_000 });
    await this.getCurrentElementHandle(parent, dataId);
  }

  private async clickToggle(parent: ElementHandle | null, dataId: string | null) {
    let lastError: unknown;

    for (let attempt = 0; attempt < 3; attempt++) {
      await this.getCurrentElementHandle(parent, dataId);
      const toggle = await this.elementHandle.waitForSelector(this.selector.toggleClass);
      try {
        await toggle.evaluate((element) => (element as HTMLElement).click());
        return;
      } catch (error) {
        lastError = error;
        await this.app.page.waitForTimeout(100);
      }
    }

    throw lastError;
  }

  async label() {
    const labelElement = await this.elementHandle.$(this.selector.labelClass);
    if (!labelElement) {
      throw new Error(`Cannot read label from ${this.selector.labelClass} of ${this.elementHandle}`);
    }
    return labelElement.textContent();
  }

  async description() {
    const descriptionElement = await this.elementHandle.$(this.selector.descriptionClass);
    if (!descriptionElement) {
      throw new Error(`Cannot read description from ${this.selector.descriptionClass} of ${this.elementHandle}`);
    }
    return descriptionElement.textContent();
  }

  async badge() {
    const badgeElement = await this.elementHandle.$(this.selector.badgeClass);
    if (!badgeElement) {
      throw new Error(`Cannot read description from ${this.selector.badgeClass} of ${this.elementHandle}`);
    }
    return badgeElement.textContent();
  }

  async isSelected() {
    const id = await this.elementHandle.getAttribute('data-id');
    const parent = await this.parentElementHandle();
    return !!(await parent?.$(`[data-id='${id}']${this.selector.selectedClass}`));
  }

  async isCollapsed() {
    return !!(await this.elementHandle.$(this.selector.collapsedClass));
  }

  async isExpanded() {
    return !(await this.elementHandle.$(this.selector.collapsedClass));
  }

  async expand() {
    if (await this.isExpanded()) {
      return;
    }
    const dataId = await this.elementHandle.getAttribute('data-id');
    const parent = await this.parentElementHandle();
    await this.clickToggle(parent, dataId);
    await this.waitForCollapsedState(false, parent, dataId);
  }

  async collapse() {
    if (await this.isCollapsed()) {
      return;
    }
    const dataId = await this.elementHandle.getAttribute('data-id');
    const parent = await this.parentElementHandle();
    await this.clickToggle(parent, dataId);
    await this.waitForCollapsedState(true, parent, dataId);
  }

  async openContextMenu() {
    return OpenSumiContextMenu.open(this.app, () => this.elementHandle.waitForSelector(this.selector.labelClass));
  }

  abstract getFsPath(): Promise<string | null>;
  abstract open(preview?: boolean): Promise<void>;
}

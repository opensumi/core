import { ElementHandle } from '@playwright/test';

import { OpenSumiApp } from './app';
import { OpenSumiContextMenu } from './context-menu';

interface ITreeNodeMatchArgs {
  dataId: string | null;
  fsPath?: string | null;
}

interface ITreeNodeStateMatchArgs extends ITreeNodeMatchArgs {
  collapsed: boolean;
  collapsedClass: string;
  toggleClass: string;
}

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

  private async findVisibleMatchingNodeHandle(
    parent: ElementHandle | null,
    dataId: string | null,
    fsPath?: string | null,
  ) {
    if (!dataId && !fsPath) {
      return null;
    }

    const args = { dataId, fsPath };
    const current = parent
      ? await parent.evaluateHandle((scope: Element, matchArgs: ITreeNodeMatchArgs) => {
          const isVisible = (element: Element) => {
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
          };
          const nodes = Array.from(scope.querySelectorAll<HTMLElement>('[data-id]')).filter(isVisible);
          return (
            (matchArgs.fsPath ? nodes.find((item) => item.getAttribute('title') === matchArgs.fsPath) : undefined) ||
            (matchArgs.dataId ? nodes.find((item) => item.getAttribute('data-id') === matchArgs.dataId) : undefined) ||
            null
          );
        }, args)
      : await this.app.page.evaluateHandle((matchArgs: ITreeNodeMatchArgs) => {
          const isVisible = (element: Element) => {
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
          };
          const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-id]')).filter(isVisible);
          return (
            (matchArgs.fsPath ? nodes.find((item) => item.getAttribute('title') === matchArgs.fsPath) : undefined) ||
            (matchArgs.dataId ? nodes.find((item) => item.getAttribute('data-id') === matchArgs.dataId) : undefined) ||
            null
          );
        }, args);
    return current.asElement() as ElementHandle<SVGElement | HTMLElement> | null;
  }

  private async getCurrentElementHandle(parent: ElementHandle | null, dataId: string | null, fsPath?: string | null) {
    const currentElement = await this.findVisibleMatchingNodeHandle(parent, dataId, fsPath);
    if (currentElement) {
      this.elementHandle = currentElement;
      return this.elementHandle;
    }

    return this.elementHandle;
  }

  private async hasCollapsedStateInScope(
    parent: ElementHandle | null,
    collapsed: boolean,
    dataId: string | null,
    fsPath?: string | null,
  ) {
    const args = {
      collapsed,
      collapsedClass: this.selector.collapsedClass,
      dataId,
      fsPath,
      toggleClass: this.selector.toggleClass,
    };
    return parent
      ? parent.evaluate((scope: Element, matchArgs: ITreeNodeStateMatchArgs) => {
          const isVisible = (element: Element) => {
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
          };

          const nodes = Array.from(scope.querySelectorAll<HTMLElement>('[data-id]')).filter((item) => {
            const matchesDataId = matchArgs.dataId && item.getAttribute('data-id') === matchArgs.dataId;
            const matchesPath = matchArgs.fsPath && item.getAttribute('title') === matchArgs.fsPath;
            return isVisible(item) && (matchesDataId || matchesPath);
          });

          return nodes.some((node) => {
            const stateElement = matchArgs.collapsed
              ? node.querySelector(matchArgs.collapsedClass)
              : node.querySelector(`${matchArgs.toggleClass}:not(${matchArgs.collapsedClass})`);
            return !!stateElement && isVisible(stateElement);
          });
        }, args)
      : this.app.page.evaluate((matchArgs: ITreeNodeStateMatchArgs) => {
          const isVisible = (element: Element) => {
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
          };

          const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-id]')).filter((item) => {
            const matchesDataId = matchArgs.dataId && item.getAttribute('data-id') === matchArgs.dataId;
            const matchesPath = matchArgs.fsPath && item.getAttribute('title') === matchArgs.fsPath;
            return isVisible(item) && (matchesDataId || matchesPath);
          });

          return nodes.some((node) => {
            const stateElement = matchArgs.collapsed
              ? node.querySelector(matchArgs.collapsedClass)
              : node.querySelector(`${matchArgs.toggleClass}:not(${matchArgs.collapsedClass})`);
            return !!stateElement && isVisible(stateElement);
          });
        }, args);
  }

  private async waitForCollapsedState(
    collapsed: boolean,
    parent: ElementHandle | null,
    dataId: string | null,
    fsPath?: string | null,
  ) {
    if (!parent && !dataId && !fsPath) {
      const selector = collapsed
        ? this.selector.collapsedClass
        : `${this.selector.toggleClass}:not(${this.selector.collapsedClass})`;
      await this.elementHandle.waitForSelector(selector);
      return;
    }

    const startedAt = Date.now();
    while (Date.now() - startedAt < 10_000) {
      if (await this.hasCollapsedStateInScope(parent, collapsed, dataId, fsPath)) {
        await this.getCurrentElementHandle(parent, dataId, fsPath);
        return;
      }
      await this.app.page.waitForTimeout(100);
    }

    throw new Error(`Timed out waiting for tree node collapsed state: ${collapsed ? 'collapsed' : 'expanded'}`);
  }

  private async clickToggle(parent: ElementHandle | null, dataId: string | null, fsPath?: string | null) {
    let lastError: unknown;

    for (let attempt = 0; attempt < 3; attempt++) {
      await this.getCurrentElementHandle(parent, dataId, fsPath);
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
    const fsPath = await this.getFsPath();
    const dataId = await this.elementHandle.getAttribute('data-id');
    const parent = await this.parentElementHandle();
    await this.clickToggle(parent, dataId, fsPath);
    await this.waitForCollapsedState(false, parent, dataId, fsPath);
  }

  async collapse() {
    if (await this.isCollapsed()) {
      return;
    }
    const fsPath = await this.getFsPath();
    const dataId = await this.elementHandle.getAttribute('data-id');
    const parent = await this.parentElementHandle();
    await this.clickToggle(parent, dataId, fsPath);
    await this.waitForCollapsedState(true, parent, dataId, fsPath);
  }

  async openContextMenu() {
    return OpenSumiContextMenu.open(this.app, () => this.elementHandle.waitForSelector(this.selector.labelClass));
  }

  abstract getFsPath(): Promise<string | null>;
  abstract open(preview?: boolean): Promise<void>;
}

import { ElementHandle } from '@playwright/test';

import { OpenSumiApp } from './app';
import { OpenSumiContextMenu } from './context-menu';

export interface IOpenSumiTreeNodeSelector {
  labelClass: string;
  descriptionClass: string;
  toggleClass: string;
  selectedClass: string;
  focusedClass: string;
  collapsedClass: string;
}

export class OpenSumiTreeNode {
  constructor(
    protected elementHandle: ElementHandle<SVGElement | HTMLElement>,
    protected app: OpenSumiApp,
    private selector: IOpenSumiTreeNodeSelector = {
      labelClass: "[class*='tree_node_displayname__']",
      descriptionClass: "[class*='tree_node_description__']",
      toggleClass: "[class*='expansion_toggle__']",
      selectedClass: "[class*='mod_selected__']",
      focusedClass: "[class*='mod_focused__']",
      collapsedClass: "[class*='mode_collapsed__']",
    },
  ) {}

  async parentElementHandle() {
    const parent = await this.elementHandle.getProperty('parentNode');
    return parent.asElement();
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
    const toggle = await this.elementHandle.waitForSelector(this.selector.toggleClass);
    await toggle.click();
    await this.elementHandle.waitForSelector(`${this.selector.toggleClass}:not(${this.selector.collapsedClass})`);
  }

  async collapse() {
    if (await this.isCollapsed()) {
      return;
    }
    const toggle = await this.elementHandle.waitForSelector(this.selector.toggleClass);
    await toggle.click();
    await this.elementHandle.waitForSelector(`${this.selector.collapsedClass}`);
  }

  async openContextMenu() {
    return OpenSumiContextMenu.open(this.app, () => this.elementHandle.waitForSelector(this.selector.labelClass));
  }
}

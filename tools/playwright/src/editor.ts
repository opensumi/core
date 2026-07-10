import { OpenSumiApp } from './app';
import { OPENSUMI_VIEW_CONTAINERS } from './constans';
import { OpenSumiTreeNode } from './tree-node';
import { keypressWithCmdCtrl, keypressWithCmdCtrlAndShift } from './utils';
import { OpenSumiView } from './view';

export class OpenSumiEditor extends OpenSumiView {
  constructor(app: OpenSumiApp, private readonly filestatElement?: OpenSumiTreeNode) {
    super(app, {
      tabSelector: `#${OPENSUMI_VIEW_CONTAINERS.EDITOR_TABS}`,
      viewSelector: `#${OPENSUMI_VIEW_CONTAINERS.EDITOR}`,
      name: 'Editor',
    });
  }

  async getTab() {
    const path = (await this.filestatElement?.getFsPath()) || '';
    const tabsItems = await (await this.getTabElement())?.$$("[class*='kt_editor_tab___']");

    if (!tabsItems) {
      return;
    }

    for (const item of tabsItems) {
      const uri = await item.getAttribute('data-uri');
      if (uri?.includes(path)) {
        return item;
      }
    }
  }

  async isPinned() {
    return (await (await this.getTab())?.getAttribute('data-pinned')) === 'true';
  }

  async isEditorTabVisible() {
    return !!(await this.getTab());
  }

  async hasPinAction() {
    return !!(await (await this.getTab())?.$("[class*='pin_tab___']"));
  }

  async hasCloseAction() {
    return !!(await (await this.getTab())?.$("[class*='close_tab___']"));
  }

  async hasVisibleDirtyIndicator() {
    const dirtyIndicator = await (await this.getTab())?.$("[class*='dirty___']");
    return (await dirtyIndicator?.isVisible()) ?? false;
  }

  async isCurrentTab() {
    return (await (await this.getTab())?.getAttribute('class'))?.includes('kt_editor_tab_current___') ?? false;
  }

  async clickPinAction() {
    const action = await (await this.getTab())?.$("[class*='pin_tab___']");
    await action?.click();
  }

  async focusPinAction() {
    const action = await (await this.getTab())?.$("[class*='pin_tab___']");
    await action?.focus();
  }

  async middleClickTab() {
    await (await this.getTab())?.click({ button: 'middle' });
  }

  async getContainer(selector?: string) {
    if (!selector) {
      return;
    }
    const container = await (await this.getViewElement())?.$(selector);
    return container;
  }

  async getCurrentTab() {
    return await (await this.getTabElement())?.waitForSelector("[class*='kt_editor_tab_current___']");
  }

  async open(preview?: boolean) {
    await this.filestatElement?.open(preview);
    // waiting editor render, it maybe fail while opening a large file.
    await this.app.page.waitForTimeout(1000);
    return this;
  }

  async isPreview() {
    const currentTab = await this.getTab();
    const isPreview = (await currentTab?.getAttribute('class'))?.includes('kt_editor_tab_preview___');
    return !!isPreview;
  }

  async isDirty() {
    const tab = await this.getTab();
    if (!tab) {
      return false;
    }
    const tabClassName = await tab.getAttribute('class');
    if (tabClassName?.includes('kt_editor_tab_dirty___')) {
      return true;
    }
    const dirtyIcon = await tab.$("[class*='dirty___']");
    const className = await dirtyIcon?.getAttribute('class');
    if (!className) {
      return false;
    }
    const hidden = className?.includes('hidden__');
    return !hidden;
  }

  async save() {
    await this.focus();
    if (!(await this.isDirty())) {
      return;
    }
    await this.page.keyboard.press(keypressWithCmdCtrl('KeyS'), { delay: 200 });
    if (!(await this.waitForClean(3000))) {
      await this.page.keyboard.press(keypressWithCmdCtrlAndShift('KeyS'), { delay: 200 });
      if (!(await this.waitForClean())) {
        throw new Error('Editor stayed dirty after save shortcuts were pressed');
      }
    }
    await this.waitForEditorDone();
  }

  private async waitForClean(timeout = 30000) {
    // waiting for saved
    try {
      await this.page.waitForFunction(
        ([selector, path]) => {
          const tabs = Array.from(document.querySelectorAll<HTMLElement>(selector));
          const tab = tabs.find((item) => item.dataset.uri?.includes(path));
          if (!tab) {
            return false;
          }
          if (Array.from(tab.classList).some((className) => className.includes('kt_editor_tab_dirty___'))) {
            return false;
          }
          const dirtyIcon = tab.querySelector<HTMLElement>("[class*='dirty___']");
          if (!dirtyIcon) {
            return true;
          }
          return Array.from(dirtyIcon.classList).some((className) => className.includes('hidden__'));
        },
        [
          `#${OPENSUMI_VIEW_CONTAINERS.EDITOR_TABS} [class*='kt_editor_tab___']`,
          (await this.filestatElement?.getFsPath()) || '',
        ],
        { timeout },
      );
      return true;
    } catch (err) {
      return false;
    }
  }

  async waitForEditorDone() {
    await this.page.waitForTimeout(200);
  }

  async close(options?: { force?: boolean }) {
    const currentTab = await this.getTabElement();
    await currentTab?.hover({
      position: {
        x: 10,
        y: 10,
      },
    });
    const closeIcon = await currentTab?.$("[class*='close_tab___']");
    await closeIcon?.click({ force: options?.force ?? false });
  }

  async saveAndClose() {
    await this.save();
    await this.close();
  }

  async undo(times = 1) {
    await this.activate();
    for (let i = 0; i < times; i++) {
      await this.app.menubar.trigger('Edit', 'Undo');
      await this.waitForEditorDone();
    }
  }

  async redo(times = 1) {
    await this.activate();
    for (let i = 0; i < times; i++) {
      await this.app.menubar.trigger('Edit', 'Redo');
      await this.waitForEditorDone();
    }
  }

  async triggerTitleMenu(name: string) {
    const tab = await this.getTabElement();
    const actions = (await tab?.$$('[class*="iconAction___"]')) || [];
    for (const action of actions) {
      const title = await action.getAttribute('title');
      if (title === name) {
        await action.click();
        break;
      }
    }
  }

  async triggerTitleMenuById(id: string) {
    const tab = await this.getTabElement();
    const actions = (await tab?.$$('[class*="iconAction___"]')) || [];
    for (const action of actions) {
      const title = await action.getAttribute('id');
      if (title === id) {
        await action.click();
        break;
      }
    }
  }
}

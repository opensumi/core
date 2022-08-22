import { OpenSumiApp } from './app';
import { OPENSUMI_VIEW_CONTAINERS } from './constans';
import { OpenSumiExplorerFileStatNode } from './explorer-view';
import { OpenSumiView } from './view';

export class OpenSumiEditor extends OpenSumiView {
  constructor(app: OpenSumiApp, private readonly filestatElement: OpenSumiExplorerFileStatNode) {
    super(app, {
      tabSelector: `#${OPENSUMI_VIEW_CONTAINERS.EDITOR_TABS}`,
      viewSelector: `#${OPENSUMI_VIEW_CONTAINERS.EDITOR}`,
      name: 'Editor',
    });
  }

  async getCurrentTab() {
    return await (await this.getTabElement())?.waitForSelector("[class*='kt_editor_tab_current___']");
  }

  async open(preview?: boolean) {
    await this.filestatElement.open(preview);
    return this;
  }

  async isPreview() {
    const currentTab = await this.getCurrentTab();
    const isPreview = (await currentTab?.getAttribute('class'))?.includes('kt_editor_tab_preview___');
    return !!isPreview;
  }

  async isDirty() {
    const dirtyIcon = await (await this.getCurrentTab())?.$("[class*='dirty___']");
    const hidden = (await dirtyIcon?.getAttribute('class'))?.includes('hidden__');
    return !hidden;
  }

  async save() {
    await this.activate();
    if (!(await this.isDirty())) {
      return;
    }
    await this.app.menubar.trigger('File', 'Save File');
  }

  async close() {
    const closeIcon = await (await this.getTabElement())?.waitForSelector("class*=['close_tab___']");
    await closeIcon?.click();
  }

  async saveAndClose() {
    await this.save();
    await this.close();
  }

  async undo(times = 1) {
    await this.activate();
    for (let i = 0; i < times; i++) {
      await this.app.menubar.trigger('Edit', 'Undo');
      await this.app.page.waitForTimeout(200);
    }
  }

  async redo(times = 1) {
    await this.activate();
    for (let i = 0; i < times; i++) {
      await this.app.menubar.trigger('Edit', 'Redo');
      await this.app.page.waitForTimeout(200);
    }
  }
}

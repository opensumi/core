import { OpenSumiApp } from './app';
import { OpenSumiContextMenu } from './context-menu';
import { OpenSumiView } from './view';

export class OpenSumiOutlineView extends OpenSumiView {
  constructor(app: OpenSumiApp) {
    super(app, {
      viewSelector: '[data-view-id="outline-view"]',
      tabSelector: '[data-view-id="outline-view"] [tabindex="0"]',
      name: 'OUTLINE',
    });
  }

  async open(): Promise<OpenSumiView | undefined> {
    const explorerEntry = this.page.locator('#opensumi-left-tabbar li#explorer').first();
    if ((await explorerEntry.count()) > 0 && (await explorerEntry.isVisible())) {
      await explorerEntry.click();
      try {
        await this.waitForVisible(3000);
        return this;
      } catch {
        // Fall back to quick open when the activity icon is selected but the side panel stays collapsed.
      }
    }

    return super.open();
  }

  async getTitleActionByName(name: string) {
    const header = await this.getTabElement();
    if (!header) {
      return;
    }
    await header.hover();
    const titleAction = await header.waitForSelector('[class*="titleActions___"]');
    const actions = await titleAction.$$('[class*="iconAction__"]');
    for (const action of actions) {
      const title = await action.getAttribute('title');
      if (name === title) {
        return action;
      }
    }
  }

  async openTabContextMenu() {
    const header = await this.getTabElement();
    if (!header) {
      return;
    }
    return OpenSumiContextMenu.open(this.app, async () => header);
  }
}

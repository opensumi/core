import { OpenSumiApp } from './app';
import { OpenSumiView } from './view';

export class OpenSumiSourceControlView extends OpenSumiView {
  private readonly treeNodeSelector = '[data-view-id="scm_view"] [class*="scm_tree_node_content___"]';

  constructor(app: OpenSumiApp, name: string) {
    super(app, {
      viewSelector: '[data-view-id="scm_view"]',
      tabSelector: '[data-view-id="scm_view"] [tabindex="0"]',
      name,
    });
  }

  async open(): Promise<OpenSumiView | undefined> {
    const scmEntry = this.page.locator('#opensumi-left-tabbar li#scm').first();
    if ((await scmEntry.count()) > 0 && (await scmEntry.isVisible())) {
      await scmEntry.click();
      try {
        await this.waitForVisible(3000);
        return this;
      } catch {
        // Fall back to quick open when the activity icon is selected but the side panel stays collapsed.
      }
    }

    return super.open();
  }

  async getTreeNode() {
    return await this.page.$(this.treeNodeSelector);
  }

  async waitForTreeNode(timeout = 10000) {
    return await this.page.waitForSelector(this.treeNodeSelector, { state: 'visible', timeout });
  }

  async getTreeNodeActionById(id: string) {
    const header = await this.getTreeNode();
    if (!header) {
      return;
    }
    await header.hover();
    const titleAction = await header.waitForSelector('[class*="titleActions___"]');
    const actions = await titleAction.$$('[class*="iconAction__"]');
    for (const action of actions) {
      const title = await action.getAttribute('id');
      if (id === title) {
        return action;
      }
    }
  }

  async getTitleActionByName(name: string) {
    const header = await this.page.$('.scm [class*="titlebar___"]');
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

  async getTitleActionById(id: string) {
    const header = await this.page.$('.scm [class*="titlebar___"]');
    if (!header) {
      return;
    }
    await header.hover();
    const titleAction = await header.waitForSelector('[class*="titleActions___"]');
    const actions = await titleAction.$$('[class*="iconAction__"]');
    for (const action of actions) {
      const itemId = await action.getAttribute('id');
      if (id === itemId) {
        return action;
      }
    }
  }
}

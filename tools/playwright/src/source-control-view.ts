import { OpenSumiApp } from './app';
import { OpenSumiView } from './view';

export class OpenSumiSourceControlView extends OpenSumiView {
  constructor(app: OpenSumiApp, name: string) {
    super(app, {
      viewSelector: '[data-view-id="scm_view"]',
      tabSelector: '[data-view-id="scm_view"] [tabindex="0"]',
      name,
    });
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

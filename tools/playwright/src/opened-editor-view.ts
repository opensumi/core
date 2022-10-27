import { OpenSumiApp } from './app';
import { OpenSumiView } from './view';

export class OpenSumiOpenedEditorView extends OpenSumiView {
  constructor(app: OpenSumiApp, workspaceName: string) {
    super(app, {
      viewSelector: '#file-opened-editor',
      tabSelector: '#file-opened-editor [tabindex="0"]',
      name: workspaceName,
    });
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
}

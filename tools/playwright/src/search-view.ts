import { OpenSumiApp } from './app';
import { OpenSumiPanel } from './panel';

export class OpenSumiSearchView extends OpenSumiPanel {
  constructor(app: OpenSumiApp) {
    super(app, 'search');
  }

  get searchInputSelector() {
    return '#search-input-field';
  }

  get replaceInputSelector() {
    return '#replace-input-field';
  }

  async getSearchResult() {
    let results;
    let files;
    const resultElement = await this.app.page.waitForSelector('[class*="result_describe__"]');
    const text = await resultElement.textContent();
    const regx = /^(\d+) results found in (\d+) files/gi;
    if (text) {
      const match = regx.exec(text);
      if (match) {
        results = Number(match[1]);
        files = Number(match[2]);
      }
    }
    return {
      results,
      files,
    };
  }

  async focusOnSearch() {
    const visible = await this.isVisible();
    if (!visible) {
      await this.open();
    }
    const $searchInput = await this.app.page.$(this.searchInputSelector);
    await $searchInput?.focus();
  }
}

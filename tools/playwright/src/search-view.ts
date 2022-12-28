import { OpenSumiApp } from './app';
import { OpenSumiPanel } from './panel';

export class OpenSumiSearchView extends OpenSumiPanel {
  constructor(app: OpenSumiApp) {
    super(app, 'SEARCH');
  }

  get searchInputSelector() {
    return '#search-input-field';
  }

  get replaceInputSelector() {
    return '#replace-input-field';
  }

  get includeInputSelector() {
    return '#include-input-field';
  }

  get excludeInputSelector() {
    return '#exclude-input-field';
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

  async getSearchInput() {
    return await this.view?.$(this.searchInputSelector);
  }

  async getReplaceInput() {
    return await this.view?.$(this.replaceInputSelector);
  }

  async getExcludeInput() {
    return await this.view?.$(this.excludeInputSelector);
  }

  async getIncludeInput() {
    return await this.view?.$(this.includeInputSelector);
  }

  async toggleDisplaySearchRules() {
    const visible = await this.isVisible();
    if (!visible) {
      await this.open();
    }
    const titleBar = await this.view?.$('[class*="search_input_title_"]');
    const checkbox = await titleBar?.$('.kt-checkbox');
    await checkbox?.click();
  }
}

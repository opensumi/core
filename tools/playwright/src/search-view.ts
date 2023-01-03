import { isDefined } from '@opensumi/ide-utils';

import { OpenSumiApp } from './app';
import { OpenSumiPanel } from './panel';
import { OpenSumiTreeNode } from './tree-node';

export interface ISearchOptions {
  search: string;
  include?: string;
  exclude?: string;
  useDefaultExclude?: boolean;
  useRegexp?: boolean;
  isMatchWhileWord?: boolean;
  isMatchCase?: boolean;
}

const SEARCH_OPTIONS = {
  MATCH_CASE: 'Match Case',
  MATCH_WHOLE_WORD: 'Match Whole Word',
  USE_REGEXP: 'Use Regular Expression',
};

export class OpenSumiSearchFileStatNode extends OpenSumiTreeNode {
  async getFsPath() {
    return await this.elementHandle.getAttribute('title');
  }

  async isFile() {
    const icon = await this.elementHandle.$("[class*='icon__']");
    if (!icon) {
      return false;
    }
    const className = await icon.getAttribute('class');
    return className?.includes('file-icon');
  }

  async getMenuItemByName(name: string) {
    const contextMenu = await this.openContextMenu();
    const menuItem = await contextMenu.menuItemByName(name);
    return menuItem;
  }

  async open() {
    await this.elementHandle.click();
  }

  async getBadge() {
    const status = await this.elementHandle.$('[class*="status___"]');
    return await status?.textContent();
  }
}

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

  async getReplaceAllButton() {
    const button = this.view?.$('[class*="replace_all_button__"]');
    return button;
  }

  async focusOnSearch() {
    const visible = await this.isVisible();
    if (!visible) {
      await this.open();
    }
    const input = await this.app.page.$(this.searchInputSelector);
    await input?.fill('');
    await input?.focus();
  }

  async focusOnReplace() {
    const visible = await this.isVisible();
    if (!visible) {
      await this.open();
    }
    const input = await this.app.page.$(this.replaceInputSelector);
    await input?.focus();
    return input;
  }

  async focusOnExclude() {
    const visible = await this.isVisible();
    if (!visible) {
      await this.open();
    }
    const input = await this.getExcludeInput();
    await input?.focus();
  }

  async focusOnInclude() {
    const visible = await this.isVisible();
    if (!visible) {
      await this.open();
    }
    const input = await this.getIncludeInput();
    await input?.focus();
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

  async getSearchAction(value: string) {
    const searchField = await this.view?.$('[class*="search_field__"]');
    if (searchField) {
      const options = await searchField.$$('[class*="search_option__"]');
      for (const option of options) {
        const title = await option.getAttribute('title');
        if (title === value) {
          return option;
        }
      }
    }
  }

  async activeSearchAction(value: string) {
    const action = await this.getSearchAction(value);
    const classname = await action?.getAttribute('class');
    if (classname?.includes('select___')) {
      return;
    }
    await action?.click();
  }

  async deactiveSearchAction(value: string) {
    const action = await this.getSearchAction(value);
    const classname = await action?.getAttribute('class');
    if (classname?.includes('select___')) {
      await action?.click();
    }
  }

  async toggleDisplaySearchRules(expected?: boolean) {
    const visible = await this.isVisible();
    if (!visible) {
      await this.open();
    }
    const titleBar = await this.view?.$('[class*="search_input_title_"]');
    const checkbox = await titleBar?.$('.kt-checkbox');
    const checked = await checkbox?.isChecked();
    if (isDefined(expected) && expected === checked) {
      return;
    }
    await checkbox?.click();
  }

  async toggleUseDefaultExclude(expected?: boolean) {
    const visible = await this.isVisible();
    if (!visible) {
      await this.open();
    }
    const wrapper = await this.view?.$('[class*="use_default_excludes_wrapper_"]');
    const checkbox = await wrapper?.$('.kt-checkbox');
    const checked = await checkbox?.isChecked();
    if (isDefined(expected) && expected === checked) {
      return;
    }
    await checkbox?.click();
  }

  async search(options: ISearchOptions) {
    if (!(await this.isVisible())) {
      await this.open();
    }
    if (!options.search) {
      return;
    }
    if (isDefined(options.isMatchCase)) {
      (await options.isMatchCase)
        ? this.activeSearchAction(SEARCH_OPTIONS.MATCH_CASE)
        : this.deactiveSearchAction(SEARCH_OPTIONS.MATCH_CASE);
    }
    if (isDefined(options.isMatchWhileWord)) {
      (await options.isMatchWhileWord)
        ? this.activeSearchAction(SEARCH_OPTIONS.MATCH_WHOLE_WORD)
        : this.deactiveSearchAction(SEARCH_OPTIONS.MATCH_WHOLE_WORD);
    }
    if (isDefined(options.useRegexp)) {
      (await options.useRegexp)
        ? this.activeSearchAction(SEARCH_OPTIONS.USE_REGEXP)
        : this.deactiveSearchAction(SEARCH_OPTIONS.USE_REGEXP);
    }
    if (options.exclude || options.include || isDefined(options.useDefaultExclude)) {
      await this.toggleDisplaySearchRules(true);
      if (options.exclude) {
        await this.focusOnExclude();
        await this.page.keyboard.type(options.exclude);
      }
      if (options.include) {
        await this.focusOnInclude();
        await this.page.keyboard.type(options.include);
      }
      const useDefaultExlude = isDefined(options.useDefaultExclude) ? options.useDefaultExclude : true;
      await this.toggleUseDefaultExclude(useDefaultExlude);
    }
    // Search on the end.
    await this.focusOnSearch();
    await this.page.keyboard.type(options.search);
  }

  async getTreeNodeByIndex(index: number) {
    const treeItems = await this.view?.$$('[class*="search_node___"]');
    if (!treeItems) {
      return;
    }
    const node = treeItems[index];
    if (node) {
      return new OpenSumiSearchFileStatNode(node, this.app);
    }
  }
}

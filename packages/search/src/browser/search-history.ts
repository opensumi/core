import { RecentStorage, isArray } from '@opensumi/ide-core-browser';

import { IContentSearchClientService } from '../common';

export const SEARCH_WORD_SCOPE = 'SEARCH_WORD';

export class SearchHistory {
  public searchHistoryList: string[] = [];

  private searchServiceClient: IContentSearchClientService;

  recentStorage: RecentStorage;

  constructor(searchServiceClient: IContentSearchClientService, recentStorage: RecentStorage) {
    this.searchServiceClient = searchServiceClient;
    this.recentStorage = recentStorage;
  }

  private currentIndex = -1;

  setRecentSearchWord() {
    if (this.currentIndex === -1) {
      this.currentIndex = this.searchHistoryList.length;
    }

    this.currentIndex = this.currentIndex - 1;
    let value = this.searchHistoryList[this.currentIndex];

    if (this.currentIndex < 0) {
      this.currentIndex = 0;
      value = this.searchHistoryList[this.currentIndex];
      return this.setSearchValue(value);
    }

    if (!value) {
      return;
    }

    if (this.searchServiceClient.searchValue === value) {
      return this.setRecentSearchWord();
    }

    this.setSearchValue(value);
  }

  setBackRecentSearchWord() {
    this.currentIndex = this.currentIndex + 1;
    let value = this.searchHistoryList[this.currentIndex];

    if (this.currentIndex >= this.searchHistoryList.length) {
      this.currentIndex = this.searchHistoryList.length - 1;
      value = this.searchHistoryList[this.currentIndex];
      return this.setSearchValue(value);
    }

    if (!value) {
      return;
    }
    if (this.searchServiceClient.searchValue === value) {
      return this.setBackRecentSearchWord();
    }
    this.setSearchValue(value);
  }

  async initSearchHistory() {
    if (this.searchHistoryList.length > 0) {
      return;
    }
    const list = await this.getMostRecentlySearchWord();
    this.searchHistoryList = this.searchHistoryList.concat(list || []);
  }

  async setSearchHistory(word: string) {
    if (this.searchHistoryList.some((value) => value === word)) {
      return;
    }
    this.searchHistoryList.push(word);
    await this.setMostRecentlySearchWord(word);
  }

  private async getMostRecentlySearchWord() {
    const recentStorage = await this.recentStorage.getScopeStorage();
    const list: string[] = (await recentStorage.get<string[]>(SEARCH_WORD_SCOPE)) || [];
    return list;
  }

  private async setMostRecentlySearchWord(word) {
    const recentStorage = await this.recentStorage.getScopeStorage();
    let list: string[] = [];
    const oldList = (await this.getMostRecentlySearchWord()) || [];

    if (isArray(word)) {
      list = list.concat(word);
    } else {
      list.push(word);
    }

    list = oldList.concat(list);
    list = Array.from(new Set(list));
    // 仅存储10个
    list = list.slice(list.length - 10, list.length);
    recentStorage.set(SEARCH_WORD_SCOPE, list);
  }

  private setSearchValue(value: string) {
    this.searchServiceClient.searchValue = value;
  }

  reset() {
    this.currentIndex = -1;
  }
}

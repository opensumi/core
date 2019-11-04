import { IWorkspaceService } from '@ali/ide-workspace';
import { IContentSearchClientService } from '../common';

export class SearchHistory {
  public searchHistoryList: string[] = [];

  private searchServiceClient: IContentSearchClientService;
  private workspaceService: IWorkspaceService;
  private currentIndex: number = -1;

  constructor(
    searchServiceClient: IContentSearchClientService,
    workspaceService: IWorkspaceService,
  ) {
    this.searchServiceClient = searchServiceClient;
    this.workspaceService = workspaceService;
  }

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
    const list = await this.workspaceService.getMostRecentlySearchWord();
    this.searchHistoryList = this.searchHistoryList.concat(list || []);
  }

  async setSearchHistory(word: string) {
    if (this.searchHistoryList.some((value) => {
      return value === word;
    })) {
      return;
    }
    this.searchHistoryList.push(word);
    this.workspaceService.setMostRecentlySearchWord(word);
  }

  private setSearchValue(value: string) {
    this.searchServiceClient.searchValue = value;
  }

  reset() {
    this.currentIndex = -1;
  }
}

import { SearchHistory } from '../../src/browser/search-history';
import {
  ContentSearchResult,
} from '../../src/common';

class MockSearchServiceClient {
  searchValue: string;
}

class MockWorkspaceService {
  catchSetMostRecentlySearchWord: string;

  async getMostRecentlySearchWord() {
    return MockWorkspaceService.mostRecentlySearchWord;
  }

  async setMostRecentlySearchWord(word: string) {
    this.catchSetMostRecentlySearchWord = word;
  }

  static mostRecentlySearchWord = ['a', 'b', 'c'];
}

describe('测试 SearchHistory', () => {
  const searchServiceClient: any = new MockSearchServiceClient();
  const workspaceService: any = new MockWorkspaceService();
  const searchHistory = new SearchHistory(searchServiceClient, workspaceService);

  test('method:initSearchHistory', async () => {
    await searchHistory.initSearchHistory();

    expect(searchHistory.searchHistoryList).toEqual(MockWorkspaceService.mostRecentlySearchWord);
  });

  test('method:setSearchHistory', async () => {
    await searchHistory.setSearchHistory('d');

    expect(searchHistory.searchHistoryList[searchHistory.searchHistoryList.length - 1]).toEqual('d');
    expect(workspaceService.catchSetMostRecentlySearchWord).toEqual('d');
  });

  test('method: setRecentSearchWord', () => {
    searchHistory.setRecentSearchWord();
    expect(searchServiceClient.searchValue).toEqual('d');
  });

  test('method: setRecentSearchWord 前进到底', () => {
    searchHistory.setRecentSearchWord();
    searchHistory.setRecentSearchWord();
    searchHistory.setRecentSearchWord();
    searchHistory.setRecentSearchWord();
    searchHistory.setRecentSearchWord();
    searchHistory.setRecentSearchWord();
    searchHistory.setRecentSearchWord();
    searchHistory.setRecentSearchWord();
    expect(searchServiceClient.searchValue).toEqual('a');
  });

  test('method: setBackRecentSearchWord', () => {
    searchHistory.setBackRecentSearchWord();
    expect(searchServiceClient.searchValue).toEqual('b');
  });

  test('method: setBackRecentSearchWord 后退到底', () => {
    searchHistory.setBackRecentSearchWord();
    searchHistory.setBackRecentSearchWord();
    searchHistory.setBackRecentSearchWord();
    searchHistory.setBackRecentSearchWord();
    searchHistory.setBackRecentSearchWord();
    searchHistory.setBackRecentSearchWord();
    searchHistory.setBackRecentSearchWord();
    expect(searchServiceClient.searchValue).toEqual('d');
  });

});

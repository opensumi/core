import { SearchHistory, SEARCH_WORD_SCOPE } from '../../src/browser/search-history';

class MockSearchServiceClient {
  searchValue: string;
}

class MockRecentStorage {
  static mostRecentlySearchWord = ['a', 'b', 'c'];

  cache: Map<string, any> = new Map();

  getScopeStorage() {
    return {
      get: (key) => this.cache.get(key) || MockRecentStorage.mostRecentlySearchWord,
      set: (key, value) => {
        this.cache.set(key, value);
      },
    };
  }
}

describe('测试 SearchHistory', () => {
  const searchServiceClient: any = new MockSearchServiceClient();
  const mockRecentStorage = new MockRecentStorage();
  const searchHistory = new SearchHistory(searchServiceClient, mockRecentStorage as any);

  test('method:initSearchHistory', async () => {
    await searchHistory.initSearchHistory();

    expect(searchHistory.searchHistoryList).toEqual(MockRecentStorage.mostRecentlySearchWord);
  });

  test('method:setSearchHistory', async () => {
    await searchHistory.setSearchHistory('d');

    expect(searchHistory.searchHistoryList[searchHistory.searchHistoryList.length - 1]).toEqual('d');
    expect(mockRecentStorage.cache.get(SEARCH_WORD_SCOPE).join(',')).toEqual('a,b,c,d');
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

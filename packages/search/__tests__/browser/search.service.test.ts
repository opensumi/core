import { Injector, Injectable } from '@opensumi/di';
import { CorePreferences } from '@opensumi/ide-core-browser';
import { URI } from '@opensumi/ide-core-common';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { IEditorDocumentModelService, WorkbenchEditorService } from '@opensumi/ide-editor/lib/browser';
import { EditorDocumentModelServiceImpl } from '@opensumi/ide-editor/lib/browser/doc-model/main';
import { IMainLayoutService } from '@opensumi/ide-main-layout/lib/common';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { MockContentSearchServer } from '../../__mocks__/content-search.service';
import { SearchModule } from '../../src/browser/';
import { SearchPreferences } from '../../src/browser/search-preferences';
import {
  IContentSearchClientService,
  ContentSearchServerPath,
  SendClientResult,
  SEARCH_STATE,
  ContentSearchResult,
  IUIState,
} from '../../src/common';

const rootUri = new URI('root');

@Injectable()
class MockWorkspaceService {
  tryGetRoots() {
    return [
      {
        uri: rootUri,
      },
    ];
  }

  setMostRecentlySearchWord() {}
}

@Injectable()
class MockMainLayoutService {
  getTabbarHandler() {}
}

@Injectable()
class MockWorkbenchEditorService {
  open() {}
  apply() {}
  get editorGroups() {
    return [];
  }
}

describe('search.service.ts', () => {
  let injector: Injector;
  let searchService: IContentSearchClientService;
  let contentSearchServer: MockContentSearchServer;

  beforeAll(() => {
    injector = createBrowserInjector([SearchModule]);

    injector.addProviders(
      {
        token: IWorkspaceService,
        useClass: MockWorkspaceService,
      },
      {
        token: ContentSearchServerPath,
        useClass: MockContentSearchServer,
      },
      {
        token: IEditorDocumentModelService,
        useClass: EditorDocumentModelServiceImpl,
      },
      {
        token: IMainLayoutService,
        useClass: MockMainLayoutService,
      },
      {
        token: WorkbenchEditorService,
        useClass: MockWorkbenchEditorService,
      },
    );

    injector.overrideProviders(
      {
        token: SearchPreferences,
        useValue: {
          'search.exclude': {
            '**/bower_components': true,
          },
          'search.include': {
            '*.java': true,
            '*.ts': true,
          },
        },
      },
      {
        token: CorePreferences,
        useValue: {
          'files.exclude': {
            '**/node_modules': true,
          },
        },
      },
    );

    searchService = injector.get(IContentSearchClientService);
    contentSearchServer = injector.get(ContentSearchServerPath);
    (searchService as any).searchAllFromDocModel = () => ({
      result: null,
    });
  });

  afterAll(() => {
    injector.disposeAll();
  });

  test('initialize', () => {
    expect(searchService.UIState).toBeDefined();
    expect((searchService as any).includeValue).toBe('*.java,*.ts');
  });

  test('method: updateUIState', () => {
    searchService.updateUIState({ isMatchCase: true, isOnlyOpenEditors: true });
    expect(searchService.UIState.isMatchCase).toBe(true);
    expect(searchService.UIState.isOnlyOpenEditors).toBe(true);
    expect(searchService.UIState.isUseRegexp).toBe(false);
  });

  test('method: search without docModel', async () => {
    searchService.updateUIState({ isMatchCase: true, isOnlyOpenEditors: false });
    searchService.searchValue = 'value';
    await searchService.search();
    expect(contentSearchServer.catchSearchValue).toBe('value');
    expect(contentSearchServer.catchSearchRootDirs).toEqual([rootUri.toString()]);
    expect(contentSearchServer.catchSearchOptions.maxResults).toBe(2000);
    expect(contentSearchServer.catchSearchOptions.matchWholeWord).toBe(false);
    expect(contentSearchServer.catchSearchOptions.useRegExp).toBe(false);
    expect(contentSearchServer.catchSearchOptions.includeIgnored).toBe(false);
    expect(contentSearchServer.catchSearchOptions.include).toEqual(['*.java', '*.ts']);
    expect(contentSearchServer.catchSearchOptions.exclude).toEqual(['**/node_modules', '**/bower_components']);
  });

  test('method: search options', async () => {
    const service: any = searchService;
    searchService.searchValue = 'value';
    (service.UIState as IUIState) = {
      isSearchFocus: false,
      isToggleOpen: true,
      isDetailOpen: false,

      // Search Options
      isMatchCase: false,
      isWholeWord: true,
      isUseRegexp: true,
      isIncludeIgnored: false,
      isOnlyOpenEditors: false,
    };
    service.includeValue = 'includeValue1, includeValue2';
    service.excludeValue = 'excludeValue';

    await service.search();
    expect(service.contentSearchServer.catchSearchValue).toBe('value');
    expect(service.contentSearchServer.catchSearchRootDirs).toEqual([rootUri.toString()]);

    expect(service.contentSearchServer.catchSearchOptions.maxResults).toBe(2000);
    expect(service.contentSearchServer.catchSearchOptions.matchCase).toBe(false);
    expect(service.contentSearchServer.catchSearchOptions.matchWholeWord).toBe(true);
    expect(service.contentSearchServer.catchSearchOptions.useRegExp).toBe(true);
    expect(service.contentSearchServer.catchSearchOptions.includeIgnored).toBe(false);
    expect(service.contentSearchServer.catchSearchOptions.include).toEqual(['includeValue1', 'includeValue2']);
    expect(service.contentSearchServer.catchSearchOptions.exclude).toEqual([
      'excludeValue',
      '**/node_modules',
      '**/bower_components',
    ]);
  });

  test('method: onSearchResult', () => {
    const service: any = searchService;

    const sendResult: ContentSearchResult = {
      fileUri: rootUri.resolve('test.js').toString(),
      line: 1,
      matchStart: 2,
      matchLength: 2,
      lineText: 'text',
    };

    const sendResults: SendClientResult[] = [
      {
        data: [],
        id: service._currentSearchId,
        searchState: SEARCH_STATE.doing,
      },
      {
        data: [sendResult],
        id: service._currentSearchId,
        searchState: SEARCH_STATE.doing,
      },
      {
        data: [],
        id: service._currentSearchId,
        searchState: SEARCH_STATE.done,
      },
    ];

    sendResults.forEach((data) => {
      service.onSearchResult(data);
    });

    expect(service.searchResults.size).toEqual(1);
    expect(service.searchResults.get(sendResult.fileUri)).toEqual([sendResult]);
  });
});

import * as path from 'path';
import { Injector, Injectable } from '@ali/common-di';
import { ILoggerManagerClient, Uri } from '@ali/ide-core-common';
import { createBrowserInjector } from '@ali/ide-dev-tool/src/injector-helper';
import { LoggerManagerClient  } from '@ali/ide-logs/src/browser/log-manage';
import { IWorkspaceService } from '@ali/ide-workspace';
// import { WorkbenchEditorService } from '@ali/ide-editor';
// import { WorkbenchEditorServiceImpl } from '@ali/ide-editor/src/browser/workbench-editor.service';
import { EditorDocumentModelServiceImpl } from '@ali/ide-editor/lib/browser/doc-model/main';
import { IEditorDocumentModelService } from '@ali/ide-editor/lib/browser';

import { ContentSearchClientService } from '../../src/browser/search.service';
import { IContentSearchClientService, ContentSearchServerPath, ContentSearchOptions } from '../../src/common';
import { SearchModule } from '../../src/browser/';

const rootUri = Uri.file(path.resolve(__dirname, '../test-resources/')).toString();

@Injectable()
class MockWorkspaceService {
  tryGetRoots() {
    return [{
      uri: rootUri,
    }];
  }

  setMostRecentlySearchWord() {

  }
}

@Injectable()
class MockSearchContentService {
  catchSearchValue: string;
  catchSearchRootDirs: string[];
  catchSearchOptions: ContentSearchOptions;

  async search(value, rootDirs , searchOptions) {
    this.catchSearchValue = value;
    this.catchSearchRootDirs = rootDirs;
    this.catchSearchOptions = searchOptions;

    return 666;
  }

  cancel() {}
}

describe('search.service.ts', () => {
  let injector: Injector;
  let searchService: IContentSearchClientService;

  beforeAll(() => {
    injector = createBrowserInjector([
      SearchModule,
    ]);

    injector.addProviders({
      token: ContentSearchClientService,
      useClass: ContentSearchClientService,
    }, {
      token: ILoggerManagerClient,
      useClass: LoggerManagerClient,
    }, {
      token: IWorkspaceService,
      useClass: MockWorkspaceService,
    }, {
      token: ContentSearchServerPath,
      useClass: MockSearchContentService,
    }, {
      token: IEditorDocumentModelService,
      useClass : EditorDocumentModelServiceImpl,
    });

    searchService = injector.get(ContentSearchClientService);
  });

  test('可以加载正常service', () => {
    expect(searchService.UIState).toBeDefined();
  });

  test('method:updateUIState', () => {
    searchService.updateUIState({ isMatchCase: true });
    expect(searchService.UIState.isMatchCase).toBe(true);
    expect(searchService.UIState.isUseRegexp).toBe(false);
  });

  test('method:search without docModel', () => {
    const service: any = searchService;
    searchService.searchValue = 'value';
    // without docModel
    service.workbenchEditorService = true;
    service.searchAllFromDocModel = () => {
      return {
        id: '666',
        result: { root: 'root' },
        searchedList: [],
      };
    };
    service.search();

    expect(service.contentSearchServer.catchSearchValue).toBe('value');
    expect(service.contentSearchServer.catchSearchRootDirs).toEqual([rootUri]);

    expect(service.contentSearchServer.catchSearchOptions.maxResults).toBe(2000);
    expect(service.contentSearchServer.catchSearchOptions.matchWholeWord).toBe(false);
    expect(service.contentSearchServer.catchSearchOptions.useRegExp).toBe(false);
    expect(service.contentSearchServer.catchSearchOptions.includeIgnored).toBe(false);
    expect(service.contentSearchServer.catchSearchOptions.include).toEqual([]);
    expect(service.contentSearchServer.catchSearchOptions.exclude).toEqual([
      '**/node_modules',
      '**/bower_components',
    ]);

    setTimeout(() => {
      expect(service.currentSearchId).toBe(666);
    });
  });

});

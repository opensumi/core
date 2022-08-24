import path from 'path';

import { Injector, Injectable } from '@opensumi/di';
import { IContextKeyService } from '@opensumi/ide-core-browser';
import { Uri, URI } from '@opensumi/ide-core-common';
import { SearchSettingId } from '@opensumi/ide-core-common/lib/settings/search';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { IEditorDocumentModelService, IEditorDocumentModelContentRegistry } from '@opensumi/ide-editor/lib/browser';
import { EditorDocumentModelServiceImpl } from '@opensumi/ide-editor/lib/browser/doc-model/main';
import { IFileServiceClient } from '@opensumi/ide-file-service/lib/common';
import { IMainLayoutService } from '@opensumi/ide-main-layout/lib/common';
import { OverlayModule } from '@opensumi/ide-overlay/lib/browser';
import { SearchPreferences } from '@opensumi/ide-search/lib/browser/search-preferences';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { IWorkspaceEditService } from '@opensumi/ide-workspace-edit';

import { SearchModule } from '../../src/browser/';
import { SearchTreeService } from '../../src/browser/search-tree.service';
import { ContentSearchClientService } from '../../src/browser/search.service';
import {
  IContentSearchClientService,
  ContentSearchServerPath,
  ContentSearchOptions,
  ContentSearchResult,
} from '../../src/common';

const rootUri = Uri.file(path.resolve(__dirname, '../test-resources/')).toString();

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
class MockSearchContentService {
  catchSearchValue: string;
  catchSearchRootDirs: string[];
  catchSearchOptions: ContentSearchOptions;

  async search(value, rootDirs, searchOptions) {
    this.catchSearchValue = value;
    this.catchSearchRootDirs = rootDirs;
    this.catchSearchOptions = searchOptions;

    return 1;
  }

  cancel() {}
}

@Injectable()
class MockWorkbenchEditorService {
  open() {}
  apply() {}
}

@Injectable()
class MockWorkspaceEditorService {
  apply() {}
}

@Injectable()
class MockEditorDocumentModelContentRegistry {
  registerEditorDocumentModelContentProvider() {}
}

@Injectable()
class MockFileServiceClient {
  getCurrentUserHome() {}
}

@Injectable()
class MockContextKeyService {
  store: Map<string, any> = new Map();
  createKey(key: string, value: any) {
    this.store.set(key, value);
    return {
      set: (val: any) => {
        this.store.set(key, val);
      },
    };
  }
  createScoped() {
    return this;
  }
  match(key) {
    return this.store.get(key) !== undefined;
  }
}

describe('search.service.ts', () => {
  let injector: Injector;
  let searchService: IContentSearchClientService;
  let searchTreeService: SearchTreeService;
  const parent: any = {
    expanded: false,
    id: 'p-1',
    name: '',
    uri: new URI('file://root'),
    children: [],
  };

  const searchResult1 = {
    fileUri: 'file://root',
    line: 1,
    matchStart: 11,
    matchLength: 12,
    renderLineText: '',
    renderStart: 2,
  };
  const searchResult2 = Object.assign({}, searchResult1, { line: 2 });
  const searchResults: Map<string, ContentSearchResult[]> = new Map();

  searchResults.set('file://root', [searchResult1, searchResult2]);

  beforeAll(() => {
    injector = createBrowserInjector([OverlayModule, SearchModule]);

    injector.overrideProviders(
      {
        token: ContentSearchClientService,
        useClass: ContentSearchClientService,
      },
      {
        token: IWorkspaceService,
        useClass: MockWorkspaceService,
      },
      {
        token: ContentSearchServerPath,
        useClass: MockSearchContentService,
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
      {
        token: IWorkspaceEditService,
        useClass: MockWorkspaceEditorService,
      },
      {
        token: IEditorDocumentModelContentRegistry,
        useClass: MockEditorDocumentModelContentRegistry,
      },
      {
        token: IContextKeyService,
        useClass: MockContextKeyService,
      },
      {
        token: IFileServiceClient,
        useClass: MockFileServiceClient,
      },
      {
        token: SearchPreferences,
        useValue: {
          [SearchSettingId.Include]: '',
          [SearchSettingId.SearchOnType]: true,
          [SearchSettingId.SearchOnTypeDebouncePeriod]: 300,
        },
      },
    );

    searchService = injector.get(ContentSearchClientService);
    searchTreeService = injector.get(SearchTreeService);

    searchService.searchResults = searchResults;
    searchService.resultTotal = { resultNum: 2, fileNum: 1 };

    // without docModel
    (searchService as any).searchAllFromDocModel = () => ({
      result: null,
    });
  });

  test('service can be work', () => {
    expect(searchTreeService._nodes).toBeDefined();
  });

  test('initialize', () => {
    const childList = (searchTreeService as any).getChildrenNodes(searchService.searchResults, parent);
    parent.children.push(childList);
    const nodeList = [parent, ...childList];
    searchTreeService.nodes = nodeList;

    expect(searchTreeService._nodes).toEqual(nodeList);
  });

  test('method: onSelect', () => {
    searchTreeService.onSelect([parent]);

    expect(searchTreeService.nodes[0].expanded).toEqual(true);
  });

  test('method: commandActuator closeResult', () => {
    searchTreeService.commandActuator('closeResult', 'file://root?index=0');

    expect(searchService.searchResults.get('file://root')!.length).toEqual(1);
  });

  test('method: commandActuator closeResults', () => {
    searchTreeService.commandActuator('closeResults', 'file://root');

    expect(searchService.searchResults.size).toEqual(0);
  });
});

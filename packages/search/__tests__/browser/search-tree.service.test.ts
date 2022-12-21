import path from 'path';

import { Injector, Injectable } from '@opensumi/di';
import { IContextKeyService } from '@opensumi/ide-core-browser';
import { Disposable, Uri, URI } from '@opensumi/ide-core-common';
import { SearchSettingId } from '@opensumi/ide-core-common/lib/settings/search';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import {
  IEditorDocumentModelService,
  IEditorDocumentModelContentRegistry,
  ResourceService,
} from '@opensumi/ide-editor/lib/browser';
import { EditorDocumentModelServiceImpl } from '@opensumi/ide-editor/lib/browser/doc-model/main';
import { ResourceServiceImpl } from '@opensumi/ide-editor/lib/browser/resource.service';
import { IFileServiceClient } from '@opensumi/ide-file-service/lib/common';
import { IMainLayoutService } from '@opensumi/ide-main-layout/lib/common';
import { OverlayModule } from '@opensumi/ide-overlay/lib/browser';
import { SearchFileNode, SearchRoot } from '@opensumi/ide-search/lib/browser/tree/tree-node.defined';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { IWorkspaceEditService } from '@opensumi/ide-workspace-edit';

import { MockContentSearchServer } from '../../__mocks__/content-search.service';
import { SearchModule } from '../../src/browser/';
import { SearchPreferences } from '../../src/browser/search-preferences';
import { SearchTreeService } from '../../src/browser/tree/search-tree.service';
import {
  IContentSearchClientService,
  ContentSearchServerPath,
  ContentSearchResult,
  ISearchTreeService,
} from '../../src/common';

const root = new URI('root');

@Injectable()
class MockWorkspaceService {
  tryGetRoots() {
    return [
      {
        uri: root,
      },
    ];
  }
  asRelativePath() {
    return '';
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
}

@Injectable()
class MockWorkspaceEditorService {
  apply() {}
}

@Injectable()
class MockEditorDocumentModelContentRegistry {
  registerEditorDocumentModelContentProvider() {
    return Disposable.create(() => {});
  }
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

describe('search-tree.service.ts', () => {
  let injector: Injector;
  let searchService: IContentSearchClientService;
  let searchTreeService: SearchTreeService;

  const searchFileUri = root.resolve('test.js');
  const searchResult = {
    fileUri: searchFileUri.toString(),
    line: 1,
    matchStart: 11,
    matchLength: 12,
    renderLineText: 'text',
    renderStart: 2,
  };
  const searchResult_2 = Object.assign({}, searchResult, { line: 2 });
  const searchResults: Map<string, ContentSearchResult[]> = new Map();

  searchResults.set(searchFileUri.toString(), [searchResult, searchResult_2]);

  beforeAll(() => {
    injector = createBrowserInjector([OverlayModule, SearchModule]);

    injector.overrideProviders(
      {
        token: ResourceService,
        useClass: ResourceServiceImpl,
      },
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

    searchService = injector.get(IContentSearchClientService);
    searchTreeService = injector.get(ISearchTreeService);

    searchService.searchResults = searchResults;
    searchService.resultTotal = { resultNum: 2, fileNum: 1 };

    // without docModel
    (searchService as any).searchAllFromDocModel = () => ({
      result: null,
    });
  });

  afterAll(() => {
    injector.disposeAll();
  });

  test('get SearchTreeNode from tree service', async () => {
    const root = (await searchTreeService.resolveChildren())[0] as SearchRoot;
    expect(root).toBeDefined();
    expect(SearchRoot.is(root)).toBeTruthy();
    const childs = await searchTreeService.resolveChildren(root);
    expect(childs.length).toBe(1);
    const fileNode = childs[0] as SearchFileNode;
    expect(SearchFileNode.is(fileNode)).toBeTruthy();
    const contents = await searchTreeService.resolveChildren(fileNode);
    expect(contents.length).toBe(2);
  });

  test('init contextKey with dom', () => {
    const dom = document.createElement('div');
    expect(searchTreeService.contextKey).toBeTruthy();
    expect(searchTreeService.contextKey.searchViewFocusedKey).toBeUndefined();
    expect(searchTreeService.contextKey.searchInputBoxFocusedKey).toBeUndefined();
    expect(searchTreeService.contextKey.hasSearchResults).toBeUndefined();
    searchTreeService.initContextKey(dom);
    expect(searchTreeService.contextKey.searchViewFocusedKey).toBeDefined();
    expect(searchTreeService.contextKey.searchInputBoxFocusedKey).toBeDefined();
    expect(searchTreeService.contextKey.hasSearchResults).toBeDefined();
  });
});

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { IContextKeyService, Uri, SymbolKind, IRange, IMarker, MarkerSeverity, StorageProvider, URI, STORAGE_SCHEMA, MarkerManager } from '@ali/ide-core-browser';
import { MockContextKeyService } from '@ali/ide-monaco/lib/browser/mocks/monaco.context-key.service';
import { IThemeService } from '@ali/ide-theme';
import { useMockStorage } from '@ali/ide-core-browser/lib/mocks/storage';
import { OutLineService, OutlineSortOrder } from '@ali/ide-outline/lib/browser/outline.service';
import { createMockedMonaco } from '@ali/ide-monaco/lib/__mocks__/monaco';
import { Injectable } from '@ali/common-di';
import { IEditorDocumentModelService } from '@ali/ide-editor/lib/browser';
import { EditorDocumentModelServiceImpl } from '@ali/ide-editor/lib/browser/doc-model/main';
import { INormalizedDocumentSymbol, DocumentSymbolStore } from '@ali/ide-editor/lib/browser/breadcrumb/document-symbol';
const injector = createBrowserInjector([]);

@Injectable()
class MockEditorService {
  cb: ({ uri: Uri }) => void;

  onActiveResourceChange(cb) {
    this.cb = cb;
  }

  fireActiveResourceChange(uri) {
    this.cb({ uri });
  }

  currentEditorGroup = new MockEditorGroup();
}

function fakeSymbolInformation(range: IRange, name: string = 'foo', kind: SymbolKind = SymbolKind.Boolean): INormalizedDocumentSymbol {
  return {
    name,
    detail: 'fake',
    kind,
    selectionRange: range,
    range,
    id: name + '__' + range.startLineNumber,
  };
}

function fakeMarker(range: IRange): IMarker {
  return { ...range, message: 'test', severity: MarkerSeverity.Error, resource: Uri.file('/file/mockpath').toString(), type: 'typescript' };
}

@Injectable()
class MockDocumentSymbolStore {
  getDocumentSymbol(uri) {
    const parentSymbol = fakeSymbolInformation(new monaco.Range(1, 1, 14, 1), 'foo');
    const childSymbol = fakeSymbolInformation(new monaco.Range(2, 1, 5, 1), 'bar2');
    const childSymbol2 = fakeSymbolInformation(new monaco.Range(6, 1, 10, 10), 'bar3', SymbolKind.Enum);
    const childSymbol3 = fakeSymbolInformation(new monaco.Range(11, 1, 13, 5), 'bar1');

    parentSymbol.parent = { children: [parentSymbol] };
    // reverse symbol 1 & 2 order to test sort by position
    parentSymbol.children = [childSymbol2, childSymbol, childSymbol3];
    return [parentSymbol];
  }
}

@Injectable()
class MockMarkerManager {
  cb: (resources: string[]) => void;
  markers: IMarker[] = [];

  onMarkerChanged(cb) {
    this.cb = cb;
  }

  fireMarkerChange(resources: string[], markers: IMarker[]) {
    this.markers = markers;
    this.cb(resources);
  }

  getMarkers(filter: any): IMarker[] {
    return this.markers;
  }
}

class MockEditorGroup {
  codeEditor = {
    monacoEditor: (global as any).monaco.editor.create(document.createElement('div')),
  };
}

@Injectable()
class MockThemeService {
  getColor(id: string) {
    return '#00000000';
  }
}

injector.addProviders(...[
  {
    token: MarkerManager,
    useClass: MockMarkerManager,
  },
  {
    token: WorkbenchEditorService,
    useClass: MockEditorService,
  },
  {
    token: IContextKeyService,
    useClass: MockContextKeyService,
  },
  {
    token: IEditorDocumentModelService,
    useClass: EditorDocumentModelServiceImpl,
  },
  {
    token: DocumentSymbolStore,
    useClass: MockDocumentSymbolStore,
  },
  {
    token: IThemeService,
    useClass: MockThemeService,
  },
]);

(global as any).monaco = createMockedMonaco() as any;

useMockStorage(injector);

describe('outline service tests', () => {
  const outlineService: OutLineService = injector.get(OutLineService);
  const mockEditorService: MockEditorService = injector.get(WorkbenchEditorService);
  const mockMarkerService: MockMarkerManager = injector.get(MarkerManager) as any;

  beforeAll(async (done) => {
    const getStorage = injector.get<StorageProvider>(StorageProvider);
    const state = await getStorage(new URI('outline').withScheme(STORAGE_SCHEMA.SCOPE));
    outlineService.initializeSetting(state);
    mockEditorService.fireActiveResourceChange(Uri.file('/file/mockpath'));
    setTimeout(() => {
      // debounce 100ms
      done();
    }, 500);
  });

  it('should be able to generate symbol tree from current editor', () => {
    const nodes = outlineService.treeNodes;
    expect(nodes.length).toEqual(4);
  });

  it('symbols sort should work', () => {
    // sort by position
    expect(outlineService.treeNodes[1].name).toEqual('bar2');
    // sort by name
    outlineService.sortType = OutlineSortOrder.ByName;
    expect(outlineService.treeNodes[1].name).toEqual('bar1');
    // sort by kind
    outlineService.sortType = OutlineSortOrder.ByKind;
    expect(outlineService.treeNodes[1].name).toEqual('bar3');
  });

  // it('debounce update should work');

  it('collapse all & expand should work', async (done) => {
    const nodes = outlineService.treeNodes;
    outlineService.collapseAll();
    expect(outlineService.treeNodes.length).toEqual(1);
    outlineService.handleTwistieClick(nodes[0]);
    setTimeout(() => {
      expect(outlineService.treeNodes.length).toEqual(4);
      done();
    }, 200);
  });

  it('select node should work', () => {
    outlineService.onSelect([outlineService.treeNodes[0]]);
    expect(outlineService.treeNodes[0].selected).toEqual(true);
  });

  it('symbol markers should work', async (done) => {
    mockMarkerService.fireMarkerChange([Uri.file('/file/mockpath').toString()], [fakeMarker(new monaco.Range(2, 1, 5, 1))]);
    setTimeout(() => {
      // 顶层节点只展示•标志，不显示具体错误数量
      expect(outlineService.treeNodes[0].badge).toEqual('•');
      // 错误所属节点展示错误数量
      expect(outlineService.treeNodes[3].badge).toEqual('1');
      done();
    }, 200);
  });
});

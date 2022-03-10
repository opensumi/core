import { IContextKeyService } from '@opensumi/ide-core-browser';
import { MockContextKeyService } from '@opensumi/ide-core-browser/__mocks__/context-key';
import { StorageProvider } from '@opensumi/ide-core-common';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { IEditorDocumentModelService, WorkbenchEditorService } from '@opensumi/ide-editor/lib/browser';
import { DocumentSymbolStore } from '@opensumi/ide-editor/lib/browser/breadcrumb/document-symbol';
import { OutlineSortOrder } from '@opensumi/ide-outline';
import {
  OutlineRoot,
  OutlineCompositeTreeNode,
  OutlineTreeNode,
} from '@opensumi/ide-outline/lib/browser/outline-node.define';
import { OutlineTreeService } from '@opensumi/ide-outline/lib/browser/services/outline-tree.service';

describe('OutlineTreeService', () => {
  let outlineTreeService: OutlineTreeService;
  const mockInjector = createBrowserInjector([]);
  const mockStorage = {
    get: (key) => {
      if (key === 'sortType') {
        return OutlineSortOrder.ByPosition;
      } else {
        return false;
      }
    },
    set: jest.fn(),
  };
  const root = new OutlineRoot({ resolveChildren: () => [] } as any, null);
  const newTreeNode = (name: string, kind = 0, isComposite?: boolean) => {
    if (isComposite) {
      return new OutlineCompositeTreeNode({ resolveChildren: () => [] } as any, root as any, { name, kind } as any, '');
    } else {
      return new OutlineTreeNode({ resolveChildren: () => [] } as any, root as any, { name, kind } as any, '');
    }
  };
  const mockDocumentSymbolStore = {
    getDocumentSymbol: jest.fn(),
  };
  beforeAll(async (done) => {
    mockInjector.overrideProviders({
      token: DocumentSymbolStore,
      useValue: mockDocumentSymbolStore,
    });

    mockInjector.overrideProviders({
      token: IEditorDocumentModelService,
      useValue: {},
    });

    mockInjector.overrideProviders({
      token: IContextKeyService,
      useClass: MockContextKeyService,
    });

    mockInjector.overrideProviders({
      token: WorkbenchEditorService,
      useValue: {},
    });

    mockInjector.overrideProviders({
      token: StorageProvider,
      useValue: () => mockStorage,
    });

    outlineTreeService = mockInjector.get(OutlineTreeService);

    await outlineTreeService.whenReady;

    done();
  });

  afterAll(() => {
    outlineTreeService.dispose();
  });

  it('should have enough API', () => {
    expect(outlineTreeService.currentUri).toBeUndefined();
    expect(outlineTreeService.sortType).toBe(OutlineSortOrder.ByPosition);
    expect(outlineTreeService.followCursor).toBeFalsy();
    expect(typeof outlineTreeService.onDidChange).toBe('function');
    expect(typeof outlineTreeService.init).toBe('function');
    expect(typeof outlineTreeService.resolveChildren).toBe('function');
    expect(typeof outlineTreeService.getTreeNodeBySymbol).toBe('function');
    expect(typeof outlineTreeService.sortComparator).toBe('function');
    expect(typeof outlineTreeService.whenReady).toBe('object');
  });

  it('sortComparator method should be work', () => {
    // sort by position
    let res = outlineTreeService.sortComparator(newTreeNode('a'), newTreeNode('a', 0, true));
    expect(res).toBe(0);
    res = outlineTreeService.sortComparator(newTreeNode('a'), newTreeNode('b'));
    expect(res).toBeLessThan(0);
    res = outlineTreeService.sortComparator(newTreeNode('a', 0, true), newTreeNode('b', 0, true));
    expect(res).toBeLessThan(0);
    res = outlineTreeService.sortComparator(newTreeNode('a'), newTreeNode('a'));
    expect(res).toBe(0);
    // sort by name
    outlineTreeService.sortType = OutlineSortOrder.ByName;
    res = outlineTreeService.sortComparator(newTreeNode('a', 0, true), newTreeNode('b', 0, true));
    expect(res).toBeLessThan(0);
    // sort by kind
    outlineTreeService.sortType = OutlineSortOrder.ByKind;
    res = outlineTreeService.sortComparator(newTreeNode('a', 2, true), newTreeNode('b', 0, true));
    expect(res).toBeGreaterThan(0);
  });

  it('onDidChange should emit while sortType change', async (done) => {
    outlineTreeService.onDidChange(() => {
      done();
    });
    outlineTreeService.sortType = OutlineSortOrder.ByPosition;
  });

  it('followCursor should emit while sortType change', async (done) => {
    outlineTreeService.onDidChange(() => {
      done();
    });
    outlineTreeService.followCursor = true;
  });

  it('resolveChildren should be work', async (done) => {
    const [root] = await outlineTreeService.resolveChildren()!;
    expect(root).toBeDefined();
    done();
  });
});

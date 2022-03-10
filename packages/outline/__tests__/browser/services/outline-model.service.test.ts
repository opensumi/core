import { IContextKeyService } from '@opensumi/ide-core-browser';
import { Disposable, URI, MarkerManager, Emitter } from '@opensumi/ide-core-common';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { IEditorDocumentModelService } from '@opensumi/ide-editor/lib/browser';
import {
  INormalizedDocumentSymbol,
  DocumentSymbolStore,
} from '@opensumi/ide-editor/lib/browser/breadcrumb/document-symbol';
import { SymbolKind } from '@opensumi/ide-extension/lib/hosted/api/worker/worker.ext-types';
import { IOutlineDecorationService } from '@opensumi/ide-outline';
import {
  OutlineRoot,
  OutlineCompositeTreeNode,
  OutlineTreeNode,
} from '@opensumi/ide-outline/lib/browser/outline-node.define';
import { OutlineEventService } from '@opensumi/ide-outline/lib/browser/services/outline-event.service';
import { OutlineModelService } from '@opensumi/ide-outline/lib/browser/services/outline-model.service';
import { OutlineTreeService } from '@opensumi/ide-outline/lib/browser/services/outline-tree.service';

import styles from '../../../../src/browser/outline-node.module.less';


describe('OutlineTreeModelService', () => {
  let outlineTreeModelService: OutlineModelService;
  const mockInjector = createBrowserInjector([]);
  const mockRaw = {
    children: [],
    name: 'test',
    id: 'id',
    detail: '',
    kind: SymbolKind.Boolean,
    range: {
      startColumn: 0,
      endColumn: 10,
      startLineNumber: 2,
      endLineNumber: 2,
    },
    selectionRange: {
      startColumn: 0,
      endColumn: 10,
      startLineNumber: 2,
      endLineNumber: 2,
    },
  } as unknown as INormalizedDocumentSymbol;

  const mockOutlineTreeService = {
    resolveChildren: jest.fn((parent?: any) => {
      if (!parent) {
        return [new OutlineRoot(mockOutlineTreeService as any, mockWorkbenchEditorService.currentEditor.currentUri)];
      } else if (!parent.raw) {
        return [new OutlineCompositeTreeNode(mockOutlineTreeService as any, parent, mockRaw, '')];
      }
    }) as any,
    whenReady: Promise.resolve(),
    onDidChange: jest.fn(() => Disposable.create(() => {})),
  };

  const mockDocumentSymbolStore = {
    getDocumentSymbol: jest.fn(() => ({ children: [] })),
  };

  const mockOutlineDecorationService = {
    updateDiagnosisInfo: jest.fn(),
  };

  const mockOutlineEventService = {
    onDidActiveChange: jest.fn(() => Disposable.create(() => {})),
    onDidSelectionChange: jest.fn(() => Disposable.create(() => {})),
    onDidChange: jest.fn(() => Disposable.create(() => {})),
  };

  const mockWorkbenchEditorService = {
    currentEditor: {
      currentUri: new URI('test.js'),
    },
    onActiveResourceChange: new Emitter().event,
  };

  const mockMarkerManager = {
    onMarkerChanged: jest.fn(() => Disposable.create(() => {})),
  };

  beforeAll(async (done) => {
    mockInjector.overrideProviders({
      token: OutlineTreeService,
      useValue: mockOutlineTreeService,
    });

    mockInjector.overrideProviders({
      token: WorkbenchEditorService,
      useValue: mockWorkbenchEditorService,
    });

    mockInjector.overrideProviders({
      token: DocumentSymbolStore,
      useValue: mockDocumentSymbolStore,
    });

    mockInjector.overrideProviders({
      token: OutlineEventService,
      useValue: mockOutlineEventService,
    });

    mockInjector.overrideProviders({
      token: MarkerManager,
      useValue: mockMarkerManager,
    });

    mockInjector.overrideProviders({
      token: IOutlineDecorationService,
      useValue: mockOutlineDecorationService,
    });

    mockInjector.overrideProviders({
      token: IEditorDocumentModelService,
      useValue: {},
    });

    mockInjector.overrideProviders({
      token: IContextKeyService,
      useValue: {},
    });

    outlineTreeModelService = mockInjector.get(OutlineModelService);

    await outlineTreeModelService.whenReady;

    await outlineTreeModelService.treeModel.root.ensureLoaded();

    done();
  });

  afterAll(() => {
    outlineTreeModelService.dispose();
  });

  it('should have enough API', () => {
    expect(typeof outlineTreeModelService.initTreeModel).toBe('function');
    expect(typeof outlineTreeModelService.dispose).toBe('function');
    expect(typeof outlineTreeModelService.onDidRefreshed).toBe('function');
    expect(typeof outlineTreeModelService.initDecorations).toBe('function');
    expect(typeof outlineTreeModelService.activeNodeDecoration).toBe('function');
    expect(typeof outlineTreeModelService.activeNodeFocusedDecoration).toBe('function');
    expect(typeof outlineTreeModelService.enactiveNodeDecoration).toBe('function');
    expect(typeof outlineTreeModelService.removeNodeDecoration).toBe('function');
    expect(typeof outlineTreeModelService.handleTreeHandler).toBe('function');
    expect(typeof outlineTreeModelService.handleTreeBlur).toBe('function');
    expect(typeof outlineTreeModelService.toggleDirectory).toBe('function');
    expect(typeof outlineTreeModelService.refresh).toBe('function');
    expect(typeof outlineTreeModelService.flushEventQueue).toBe('function');
    expect(outlineTreeModelService.flushEventQueuePromise).toBeUndefined();
    expect(outlineTreeModelService.outlineTreeHandle).toBeUndefined();
    expect(outlineTreeModelService.decorations).toBeDefined();
    expect(outlineTreeModelService.treeModel).toBeDefined();
    expect(outlineTreeModelService.focusedNode).toBeUndefined();
    expect(Array.isArray(outlineTreeModelService.selectedNodes)).toBeTruthy();
  });

  it('should init success', () => {
    expect(mockOutlineTreeService.resolveChildren).toBeCalledTimes(3);
  });

  it('initTreeModel method should be work', () => {
    expect(mockOutlineEventService.onDidActiveChange).toBeCalledTimes(1);
    expect(mockOutlineEventService.onDidChange).toBeCalledTimes(1);
    expect(mockOutlineEventService.onDidSelectionChange).toBeCalledTimes(1);
    expect(mockMarkerManager.onMarkerChanged).toBeCalledTimes(1);
  });

  it('activeNodeDecoration method should be work', () => {
    const node = outlineTreeModelService.treeModel.root!.children![0] as OutlineTreeNode;
    outlineTreeModelService.activeNodeDecoration(node);
    const decoration = outlineTreeModelService.decorations.getDecorations(node);
    expect(decoration).toBeDefined();
    expect(decoration!.classlist).toEqual([styles.mod_selected, styles.mod_focused]);
  });

  it('enactiveNodeDecoration method should be work', () => {
    const node = outlineTreeModelService.treeModel.root!.children![0] as OutlineTreeNode;
    outlineTreeModelService.activeNodeDecoration(node);
    let decoration = outlineTreeModelService.decorations.getDecorations(node);
    expect(decoration).toBeDefined();
    expect(decoration!.classlist).toEqual([styles.mod_selected, styles.mod_focused]);
    outlineTreeModelService.enactiveNodeDecoration();
    decoration = outlineTreeModelService.decorations.getDecorations(node);
    expect(decoration).toBeDefined();
    expect(decoration!.classlist).toEqual([styles.mod_selected]);
  });

  it('removeNodeDecoration method should be work', () => {
    const node = outlineTreeModelService.treeModel.root!.children![0] as OutlineTreeNode;
    outlineTreeModelService.activeNodeDecoration(node);
    let decoration = outlineTreeModelService.decorations.getDecorations(node);
    outlineTreeModelService.removeNodeDecoration();
    decoration = outlineTreeModelService.decorations.getDecorations(node);
    expect(decoration).toBeDefined();
    expect(decoration!.classlist).toEqual([]);
  });

  it('handleTreeHandler method should be work', () => {
    const treeHandle = { ensureVisible: () => {} } as any;
    outlineTreeModelService.handleTreeHandler(treeHandle);
    expect(outlineTreeModelService.outlineTreeHandle).toEqual(treeHandle);
  });

  it('handleTreeBlur method should be work', () => {
    const node = outlineTreeModelService.treeModel.root!.children![0] as OutlineTreeNode;
    outlineTreeModelService.initDecorations(outlineTreeModelService.treeModel.root);
    outlineTreeModelService.activeNodeDecoration(node);
    let decoration = outlineTreeModelService.decorations.getDecorations(node);
    expect(decoration).toBeDefined();
    expect(decoration!.classlist).toEqual([styles.mod_selected, styles.mod_focused]);
    outlineTreeModelService.handleTreeBlur();
    decoration = outlineTreeModelService.decorations.getDecorations(node);
    expect(decoration).toBeDefined();
    expect(decoration!.classlist).toEqual([styles.mod_selected]);
  });

  it('handleTwistierClick method should be work', () => {
    const treeHandle = { collapseNode: jest.fn(), expandNode: jest.fn() } as any;
    let mockNode = { expanded: false };
    outlineTreeModelService.handleTreeHandler(treeHandle);
    outlineTreeModelService.toggleDirectory(mockNode as any);
    expect(treeHandle.expandNode).toBeCalledTimes(1);
    mockNode = { expanded: true };
    outlineTreeModelService.toggleDirectory(mockNode as any);
    expect(treeHandle.collapseNode).toBeCalledTimes(1);
  });

  it('refresh method should be work', async (done) => {
    outlineTreeModelService.onDidRefreshed(() => {
      expect(mockOutlineDecorationService.updateDiagnosisInfo).toBeCalledTimes(1);
      done();
    });
    outlineTreeModelService.refresh();
  });

  it('collapseAll method should be work', async (done) => {
    await outlineTreeModelService.collapseAll();
    const node = outlineTreeModelService.treeModel.root!.children![0] as OutlineTreeNode;
    expect((node as OutlineCompositeTreeNode).expanded).toBeFalsy();
    done();
  });

  it('location method should be work', async (done) => {
    const treeHandle = { ensureVisible: jest.fn() } as any;
    outlineTreeModelService.handleTreeHandler(treeHandle);
    const node = outlineTreeModelService.treeModel.root!.children![0] as OutlineTreeNode;
    await outlineTreeModelService.location(node);
    expect(treeHandle.ensureVisible).toBeCalledTimes(1);
    done();
  });
});

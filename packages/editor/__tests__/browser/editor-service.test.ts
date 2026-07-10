import { CorePreferences, IContextKeyService, PreferenceService } from '@opensumi/ide-core-browser';
import { Deferred, Disposable, IEventBus, URI, createContributionProvider } from '@opensumi/ide-core-common';
import {
  BrowserEditorContribution,
  CodeEditorDidVisibleEvent,
  DragOverPosition,
  EditorComponentRegistry,
  EditorGroupChangeEvent,
  EditorGroupCloseEvent,
  EditorOpenType,
  EmptyDocCacheImpl,
  IEditorDecorationCollectionService,
  IEditorDocumentModelContentRegistry,
  IEditorDocumentModelService,
  IEditorFeatureRegistry,
  ResourceDecorationNeedChangeEvent,
  ResourceOpenTypeChangedEvent,
} from '@opensumi/ide-editor/lib/browser';
import { EditorComponentRegistryImpl } from '@opensumi/ide-editor/lib/browser/component';
import { isEOLStack, isEditStack } from '@opensumi/ide-editor/lib/browser/doc-model/editor-is-fn';
import {
  EditorDocumentModelContentRegistryImpl,
  EditorDocumentModelServiceImpl,
  SaveTask,
} from '@opensumi/ide-editor/lib/browser/doc-model/main';
import { EditorCollectionServiceImpl } from '@opensumi/ide-editor/lib/browser/editor-collection.service';
import { EditorDecorationCollectionService } from '@opensumi/ide-editor/lib/browser/editor.decoration.service';
import { EditorFeatureRegistryImpl } from '@opensumi/ide-editor/lib/browser/feature';
import { SplitDirection } from '@opensumi/ide-editor/lib/browser/grid/grid.service';
import { LanguageService } from '@opensumi/ide-editor/lib/browser/language/language.service';
import { ResourceServiceImpl } from '@opensumi/ide-editor/lib/browser/resource.service';
import { EditorGroup, WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';
import {
  EditorCollectionService,
  EditorGroupSplitAction,
  ILanguageService,
  ResourceService,
  WorkbenchEditorService,
} from '@opensumi/ide-editor/lib/common';
import { IDocPersistentCacheProvider } from '@opensumi/ide-editor/lib/common';
import { MonacoService } from '@opensumi/ide-monaco';
import { IMessageService } from '@opensumi/ide-overlay';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { MockWorkspaceService } from '@opensumi/ide-workspace/lib/common/mocks';
import { IConfigurationService } from '@opensumi/monaco-editor-core/esm/vs/platform/configuration/common/configuration';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { useMockStorage } from '../../../core-browser/__mocks__/storage';
import { MockContextKeyService } from '../../../monaco/__mocks__/monaco.context-key.service';
import { MockedMonacoService } from '../../../monaco/__mocks__/monaco.service.mock';

import {
  TestEditorDocumentProvider,
  TestResourceComponent,
  TestResourceProvider,
  TestResourceResolver,
  TestResourceResolver2,
  doNotClose,
} from './test-providers';

const injector = createBrowserInjector([]);

injector.addProviders(
  ...[
    {
      token: EditorCollectionService,
      useClass: EditorCollectionServiceImpl,
    },
    {
      token: WorkbenchEditorService,
      useClass: WorkbenchEditorServiceImpl,
    },
    {
      token: ResourceService,
      useClass: ResourceServiceImpl,
    },
    {
      token: EditorComponentRegistry,
      useClass: EditorComponentRegistryImpl,
    },
    {
      token: IEditorDecorationCollectionService,
      useClass: EditorDecorationCollectionService,
    },
    {
      token: IEditorDocumentModelContentRegistry,
      useClass: EditorDocumentModelContentRegistryImpl,
    },
    {
      token: IEditorDocumentModelService,
      useClass: EditorDocumentModelServiceImpl,
    },
    {
      token: ILanguageService,
      useClass: LanguageService,
    },
    {
      token: MonacoService,
      useClass: MockedMonacoService,
    },
    {
      token: IWorkspaceService,
      useClass: MockWorkspaceService,
    },
    {
      token: IDocPersistentCacheProvider,
      useClass: EmptyDocCacheImpl,
    },
    {
      token: IEditorFeatureRegistry,
      useClass: EditorFeatureRegistryImpl,
    },
    {
      token: IContextKeyService,
      useClass: MockContextKeyService,
    },
    {
      token: IMessageService,
      useValue: {},
    },
  ],
);
useMockStorage(injector);
injector.overrideProviders({
  token: CorePreferences,
  useValue: {
    'editor.previewMode': true,
  },
});
injector.overrideProviders({
  token: IConfigurationService,
  useValue: {
    getValue() {
      return true;
    },
    onDidChangeConfiguration() {
      return new Disposable();
    },
  },
});
injector.overrideProviders({
  token: PreferenceService,
  useValue: {
    get() {
      return true;
    },
    onPreferenceChanged() {
      return new Disposable();
    },
    onPreferencesChanged() {
      return new Disposable();
    },
  },
});
createContributionProvider(injector, BrowserEditorContribution);

describe('editor collection service tests', () => {
  it('should be able to create and dispose editors', async () => {
    const editorService: EditorCollectionService = injector.get(EditorCollectionService);
    const editor = await editorService.createCodeEditor(document.createElement('div'));
    expect(editor).toBeDefined();

    expect(editorService.listEditors().length).toBe(1);

    const diffEditor = await editorService.createDiffEditor(document.createElement('div'));
    expect(diffEditor).toBeDefined();

    expect(editorService.listEditors().length).toBe(3);
    expect(editorService.listDiffEditors().length).toBe(1);

    editor.dispose();
    diffEditor.dispose();

    expect(editorService.listEditors().length).toBe(0);
    expect(editorService.listDiffEditors().length).toBe(0);
  });
});

describe('workbench editor service tests', () => {
  // prepare
  const editorService: WorkbenchEditorService = injector.get(WorkbenchEditorService);

  const resourceService: ResourceService = injector.get(ResourceService);
  const editorComponentRegistry: EditorComponentRegistry = injector.get(EditorComponentRegistry);
  const editorDocModelRegistry: IEditorDocumentModelContentRegistry = injector.get(IEditorDocumentModelContentRegistry);
  const eventBus: IEventBus = injector.get(IEventBus);

  const closeAllEditorGroups = async () => {
    for (const group of [...editorService.editorGroups] as EditorGroup[]) {
      while (group.pinnedTabCount > 0 && group.resources.length > 0) {
        group.unpinTab(group.resources[0].uri);
      }
    }
    await editorService.closeAll();
  };

  const disposer = new Disposable();
  beforeAll(() => {
    injector.mockCommand('explorer.location');
    const globalContextKeyService: IContextKeyService = injector.get(IContextKeyService);
    const editorContextKeyService = globalContextKeyService.createScoped();
    editorService.setEditorContextKeyService(editorContextKeyService);
    (editorService as unknown as WorkbenchEditorServiceImpl).prepareContextKeyService();
    disposer.addDispose(resourceService.registerResourceProvider(TestResourceProvider));
    disposer.addDispose(editorComponentRegistry.registerEditorComponent(TestResourceComponent));
    disposer.addDispose(editorComponentRegistry.registerEditorComponentResolver('test', TestResourceResolver));
    disposer.addDispose(editorComponentRegistry.registerEditorComponentResolver('test', TestResourceResolver2));
    disposer.addDispose(editorDocModelRegistry.registerEditorDocumentModelContentProvider(TestEditorDocumentProvider));
    (editorService as any).contributionsReady.resolve();
    editorService.onDidEditorGroupsChanged(() => {
      editorService.editorGroups.forEach((g) => {
        if (!g.codeEditor) {
          (g as EditorGroup).createEditor(document.createElement('div'));
          (g as EditorGroup).createDiffEditor(document.createElement('div'));
        }
      });
    });
  });

  it('should be able to open uri', async () => {
    const testCodeUri = new URI('test://testUri1');
    const listener = jest.fn();
    const disposer = (editorService.currentEditorGroup as EditorGroup).onDidEditorGroupTabChanged(listener);

    await editorService.open(testCodeUri);

    expect(editorService.currentResource).toBeDefined();
    expect(editorService.currentResource!.uri.toString()).toBe(testCodeUri.toString());
    expect(listener).toHaveBeenCalled();

    await editorService.closeAll();
    disposer.dispose();
  });

  it('should be able to fire loading state for big resources', async () => {
    expect.assertions(2);
    const listener = jest.fn();
    const testLoadingCodeUri = new URI('test://test/loading');
    const testCodeUri = new URI('test://testUri1');
    const defered = new Deferred();
    const disposer = editorService.currentEditorGroup.onDidEditorGroupContentLoading(async (resource) => {
      listener();
      const status = editorService.currentEditorGroup.resourceStatus.get(resource);
      expect(status).toBeDefined();
      await status?.finally(async () => {
        disposer.dispose();
        await editorService.closeAll();
        defered.resolve();
      });
    });

    await editorService.open(testCodeUri);
    await editorService.open(testLoadingCodeUri);
    expect(listener).toHaveBeenCalledTimes(1);
    await defered.promise;
  });

  it('should keep resource status and emit loading when reopening with new type takes time', async () => {
    jest.useFakeTimers();
    const testCodeUri = new URI('test://testUri1');
    await editorService.open(testCodeUri, { preview: false });
    const group = editorService.currentEditorGroup as EditorGroup;

    const displayDeferred = new Deferred<void>();
    const displaySpy = jest
      .spyOn(group as any, 'displayResourceComponent')
      .mockImplementation(async () => displayDeferred.promise);
    const loadingSpy = jest.spyOn(group as any, 'notifyTabLoading');

    try {
      eventBus.fire(new ResourceOpenTypeChangedEvent(testCodeUri));
      await Promise.resolve();

      const status = group.resourceStatus.get(group.currentResource!);
      expect(status).toBeInstanceOf(Promise);

      jest.advanceTimersByTime(80);
      expect(loadingSpy).toHaveBeenCalledTimes(1);

      displayDeferred.resolve();
      await status;

      expect(displaySpy).toHaveBeenCalled();
    } finally {
      displaySpy.mockRestore();
      loadingSpy.mockRestore();
      jest.useRealTimers();
      await editorService.closeAll();
    }
  });

  it('should clear delayed loading when open type change resolves quickly', async () => {
    jest.useFakeTimers();
    const testCodeUri = new URI('test://testUri1');
    await editorService.open(testCodeUri, { preview: false });
    const group = editorService.currentEditorGroup as EditorGroup;

    const displaySpy = jest
      .spyOn(group as any, 'displayResourceComponent')
      .mockImplementation(async () => Promise.resolve());
    const loadingSpy = jest.spyOn(group as any, 'notifyTabLoading');

    try {
      eventBus.fire(new ResourceOpenTypeChangedEvent(testCodeUri));
      await Promise.resolve();

      const status = group.resourceStatus.get(group.currentResource!);
      await status;

      jest.runOnlyPendingTimers();
      expect(loadingSpy).not.toHaveBeenCalled();
    } finally {
      displaySpy.mockRestore();
      loadingSpy.mockRestore();
      jest.useRealTimers();
      await editorService.closeAll();
    }
  });

  it('should be able to open component', async () => {
    const testComponentUri = new URI('test://component');
    const listener = jest.fn();
    const disposer = (editorService.currentEditorGroup as EditorGroup).onDidEditorGroupBodyChanged(listener);

    await editorService.open(testComponentUri);
    expect(editorService.editorGroups[0].currentOpenType).toBeDefined();
    expect(editorService.editorGroups[0].currentOpenType!.type).toBe(EditorOpenType.component);
    expect(listener).toHaveBeenCalled();

    await editorService.closeAll();

    await editorService.open(testComponentUri, { preview: false, forceOpenType: { type: EditorOpenType.code } });
    expect(editorService.editorGroups[0].currentOpenType).toBeDefined();
    expect(editorService.editorGroups[0].currentOpenType!.type).toBe(EditorOpenType.code);

    // 测试 getState 方法
    expect(editorService.editorGroups[0].getState()).toEqual({
      uris: ['test://component'],
      current: 'test://component',
      previewIndex: -1,
    });

    await editorService.closeAll();

    disposer.dispose();
  });

  it('should be able to split', async () => {
    const testCodeUri = new URI('test://testUri1');
    await editorService.open(testCodeUri);
    await editorService.open(testCodeUri, { split: EditorGroupSplitAction.Right });
    await editorService.open(testCodeUri, { split: EditorGroupSplitAction.Bottom });
    expect(editorService.editorGroups.length).toBe(3);

    await editorService.closeAll();
  });

  it('should focus editor', async () => {
    const testCodeUri = new URI('test:///testuri1');
    const focused = jest.fn();
    editorService.currentEditorGroup.codeEditor.monacoEditor.onDidFocusEditorText(focused);
    await editorService.open(testCodeUri, { focus: true });
    eventBus.fire(
      new CodeEditorDidVisibleEvent({
        groupName: editorService.currentEditorGroup.name,
        editorId: editorService.currentEditorGroup.codeEditor.getId(),
        type: EditorOpenType.code,
      }),
    );

    expect(focused).toHaveBeenCalled();

    await editorService.closeAll();
  });

  it('preview mode should work', async () => {
    const testCodeUri = new URI('test://testUri1');
    await editorService.open(testCodeUri, { preview: true });
    const testCodeUri2 = new URI('test://testUri2');
    await editorService.open(testCodeUri2, { preview: true });
    expect(editorService.editorGroups[0].resources.length).toBe(1);

    await editorService.closeAll();
  });

  it('pined mode should work', async () => {
    const testCodeUri = new URI('test://testUri1');
    await editorService.open(testCodeUri, { preview: false });
    const testCodeUri2 = new URI('test://testUri2');
    await editorService.open(testCodeUri2, { preview: false });
    expect(editorService.editorGroups[0].resources.length).toBe(2);

    await editorService.closeAll();
  });

  it('pined uri should be empty after close all', async () => {
    const testCodeUri = new URI('test://testUri1');
    await editorService.open(testCodeUri, { preview: true });
    await editorService.closeAll();
    expect((editorService as WorkbenchEditorServiceImpl).currentEditorGroup.previewURI).toBeNull();
    await editorService.open(testCodeUri, { preview: true });
    expect(editorService.editorGroups[0].resources.length).toBe(1);

    await editorService.closeAll();
  });

  it('should keep pinned tabs as a leading prefix without changing the active resource', async () => {
    const a = new URI('test://pin/a');
    const b = new URI('test://pin/b');
    const c = new URI('test://pin/c');
    await editorService.open(a, { preview: false });
    await editorService.open(b, { preview: false });
    await editorService.open(c, { preview: false });

    const group = editorService.currentEditorGroup as EditorGroup;
    expect(group.pinTab(b)).toBe(true);
    expect(group.resources.map((resource) => resource.uri.toString())).toEqual([b, a, c].map(String));
    expect(group.pinnedTabCount).toBe(1);
    expect(group.currentResource?.uri.toString()).toBe(c.toString());

    expect(group.pinTab(c)).toBe(true);
    expect(group.resources.map((resource) => resource.uri.toString())).toEqual([b, c, a].map(String));
    expect(group.pinnedTabCount).toBe(2);

    expect(group.unpinTab(b)).toBe(true);
    expect(group.resources.map((resource) => resource.uri.toString())).toEqual([c, b, a].map(String));
    expect(group.isPinned(c)).toBe(true);
    expect(group.isPinned(b)).toBe(false);

    while (group.pinnedTabCount > 0) {
      group.unpinTab(group.resources[0].uri);
    }
    await group.closeAll();
  });

  it('should keep open a preview when it becomes pinned and never restore preview on unpin', async () => {
    const uri = new URI('test://pin/preview');
    await editorService.open(uri, { preview: true });
    const group = editorService.currentEditorGroup as EditorGroup;

    expect(group.previewURI?.toString()).toBe(uri.toString());
    expect(group.pinTab(uri)).toBe(true);
    expect(group.previewURI).toBeNull();
    expect(group.isPinned(uri)).toBe(true);

    expect(group.unpinTab(uri)).toBe(true);
    expect(group.previewURI).toBeNull();
    expect(group.isPinned(uri)).toBe(false);
    expect(group.pinTab(new URI('test://pin/not-open'))).toBe(false);

    await group.close(uri, { force: true });
  });

  it.each(['file', 'untitled', 'diff', 'mergeEditor', 'custom-editor', 'webview'])(
    'should keep pinned state independent of the %s tab input type',
    (scheme) => {
      const group = editorService.currentEditorGroup as EditorGroup;
      const uri = new URI(`${scheme}://pin/type`);
      group.resources = [{ uri, name: `${scheme}-tab` } as any];

      expect(group.pinTab(uri)).toBe(true);
      expect(group.isPinned(uri)).toBe(true);
      expect(group.unpinTab(uri)).toBe(true);
      expect(group.isPinned(uri)).toBe(false);

      group.resources = [];
    },
  );

  it('should insert an ordinary tab after the pinned prefix when a pinned tab is active', async () => {
    const firstPinned = new URI('test://pin/open-pinned-first');
    const secondPinned = new URI('test://pin/open-pinned-second');
    const ordinary = new URI('test://pin/open-ordinary');
    await editorService.open(firstPinned, { preview: false });
    await editorService.open(secondPinned, { preview: false });
    const group = editorService.currentEditorGroup as EditorGroup;
    group.pinTab(firstPinned);
    group.pinTab(secondPinned);
    await group.open(firstPinned, { preview: false });

    try {
      await group.open(ordinary, { preview: false });

      expect(group.resources.map((resource) => resource.uri.toString())).toEqual(
        [firstPinned, secondPinned, ordinary].map(String),
      );
      expect(group.pinnedTabCount).toBe(2);
      expect(group.isPinned(firstPinned)).toBe(true);
      expect(group.isPinned(secondPinned)).toBe(true);
      expect(group.isPinned(ordinary)).toBe(false);
    } finally {
      await closeAllEditorGroups();
    }
  });

  it('should preserve pin state when splitting a pinned tab', async () => {
    const uri = new URI('test://pin/split');
    await editorService.open(uri, { preview: false });
    const source = editorService.currentEditorGroup as EditorGroup;
    source.pinTab(uri);

    try {
      await source.split(EditorGroupSplitAction.Right, uri, { focus: true });
      const target = editorService.editorGroups.find((group) => group !== source) as EditorGroup;
      expect(source.isPinned(uri)).toBe(true);
      expect(target.isPinned(uri)).toBe(true);
    } finally {
      await closeAllEditorGroups();
    }
  });

  it('should change pin state when a same-group drag crosses the pinned boundary', async () => {
    const a = new URI('test://pin/drag-a');
    const b = new URI('test://pin/drag-b');
    const c = new URI('test://pin/drag-c');
    await editorService.open(a, { preview: false });
    await editorService.open(b, { preview: false });
    await editorService.open(c, { preview: false });
    const group = editorService.currentEditorGroup as EditorGroup;
    group.pinTab(a);

    try {
      await group.dropUri(c, DragOverPosition.CENTER, group, group.resources[0]);
      expect(group.resources.map((resource) => resource.uri.toString())).toEqual([c, a, b].map(String));
      expect(group.pinnedTabCount).toBe(2);
      expect(group.isPinned(a)).toBe(true);
      expect(group.isPinned(c)).toBe(true);

      const firstOrdinary = group.resources[group.pinnedTabCount];
      await group.dropUri(c, DragOverPosition.CENTER, group, firstOrdinary);
      expect(group.resources.map((resource) => resource.uri.toString())).toEqual([a, b, c].map(String));
      expect(group.pinnedTabCount).toBe(1);
      expect(group.isPinned(a)).toBe(true);
      expect(group.isPinned(c)).toBe(false);
    } finally {
      await closeAllEditorGroups();
    }
  });

  it('should derive pin state from the target region during a cross-group drop', async () => {
    const sourceUri = new URI('test://pin/cross-source');
    const targetUri = new URI('test://pin/cross-target');
    await editorService.open(sourceUri, { preview: false });
    const source = editorService.currentEditorGroup as EditorGroup;
    await source.split(EditorGroupSplitAction.Right, targetUri, { focus: true });
    const target = editorService.editorGroups.find((group) => group !== source) as EditorGroup;
    target.pinTab(targetUri);

    try {
      await target.dropUri(sourceUri, DragOverPosition.CENTER, source, target.resources[0]);
      expect(target.resources.map((resource) => resource.uri.toString())).toEqual([sourceUri, targetUri].map(String));
      expect(target.pinnedTabCount).toBe(2);
      expect(target.isPinned(sourceUri)).toBe(true);
      expect(target.isPinned(targetUri)).toBe(true);
      expect(source.resources.some((resource) => resource.uri.isEqual(sourceUri))).toBe(false);
    } finally {
      await closeAllEditorGroups();
    }
  });

  it('should decrement the pinned boundary when explicitly closing a pinned tab', async () => {
    const a = new URI('test://pin/close-a');
    const b = new URI('test://pin/close-b');
    const ordinary = new URI('test://pin/close-ordinary');
    await editorService.open(a, { preview: false });
    await editorService.open(b, { preview: false });
    await editorService.open(ordinary, { preview: false });
    const group = editorService.currentEditorGroup as EditorGroup;
    group.pinTab(a);
    group.pinTab(b);

    try {
      await group.close(a, { force: true });

      expect(group.resources.map((resource) => resource.uri.toString())).toEqual([b, ordinary].map(String));
      expect(group.pinnedTabCount).toBe(1);
      expect(group.isPinned(b)).toBe(true);
      expect(group.isPinned(ordinary)).toBe(false);
    } finally {
      await closeAllEditorGroups();
    }
  });

  it('should protect pinned tabs from bulk close operations', async () => {
    const pinned = new URI('test://pin/protected');
    const target = new URI('test://pin/target');
    const other = new URI('test://pin/other');
    await editorService.open(pinned, { preview: false });
    await editorService.open(target, { preview: false });
    await editorService.open(other, { preview: false });
    const group = editorService.currentEditorGroup as EditorGroup;
    group.pinTab(pinned);

    try {
      await group.closeOthers(target);
      expect(group.resources.map((resource) => resource.uri.toString())).toEqual([pinned, target].map(String));
      expect(group.pinnedTabCount).toBe(1);
      expect(group.currentResource?.uri.toString()).toBe(target.toString());

      await group.open(other, { preview: false });
      await group.closeToRight(pinned);
      expect(group.resources.map((resource) => resource.uri.toString())).toEqual([pinned.toString()]);
      expect(group.pinnedTabCount).toBe(1);
      expect(group.currentResource?.uri.toString()).toBe(pinned.toString());

      await group.open(target, { preview: false });
      await group.closeSaved();
      expect(group.resources.map((resource) => resource.uri.toString())).toEqual([pinned.toString()]);
      expect(group.pinnedTabCount).toBe(1);
      expect(group.currentResource?.uri.toString()).toBe(pinned.toString());

      await group.open(target, { preview: false });
      await group.closeAll();
      expect(group.resources.map((resource) => resource.uri.toString())).toEqual([pinned.toString()]);
      expect(group.pinnedTabCount).toBe(1);
      expect(group.isPinned(pinned)).toBe(true);
      expect(group.currentResource?.uri.toString()).toBe(pinned.toString());

      await group.closeAll({ closePinned: true, force: true });
      expect(group.resources).toHaveLength(0);
      expect(group.pinnedTabCount).toBe(0);
      expect(group.currentResource).toBeNull();
    } finally {
      await closeAllEditorGroups();
    }
  });

  it('should preserve closeSaved fallback and close-event order', async () => {
    const savedBefore = new URI('test://close-saved/before');
    const activeSaved = new URI('test://close-saved/active');
    const dirtyAfter = new URI('test://close-saved/dirty-after');
    const dirtyLast = new URI('test://close-saved/dirty-last');
    await editorService.open(savedBefore, { preview: false });
    await editorService.open(activeSaved, { preview: false });
    await editorService.open(dirtyLast, { backend: true, preview: false });
    await editorService.open(dirtyAfter, { backend: true, preview: false });
    const group = editorService.currentEditorGroup as EditorGroup;
    eventBus.fire(new ResourceDecorationNeedChangeEvent({ uri: dirtyAfter, decoration: { dirty: true } }));
    eventBus.fire(new ResourceDecorationNeedChangeEvent({ uri: dirtyLast, decoration: { dirty: true } }));
    const closed: string[] = [];
    const tabOperations: Array<{ uri: string; index: number }> = [];
    const disposer = eventBus.on(EditorGroupCloseEvent, (event) => {
      if (event.payload.group === group) {
        closed.push(event.payload.resource.uri.toString());
      }
    });
    const tabDisposer = group.onDidEditorGroupTabOperation((operation) => {
      if (operation.type === 'close') {
        tabOperations.push({ uri: operation.resource.uri.toString(), index: operation.index });
      }
    });

    try {
      await group.closeSaved();

      expect(group.resources.map((resource) => resource.uri.toString())).toEqual([dirtyAfter, dirtyLast].map(String));
      expect(group.currentResource?.uri.toString()).toBe(dirtyAfter.toString());
      expect(closed).toEqual([savedBefore, activeSaved].map(String));
      expect(tabOperations).toEqual([
        { uri: savedBefore.toString(), index: 0 },
        { uri: activeSaved.toString(), index: 0 },
      ]);
    } finally {
      disposer.dispose();
      tabDisposer.dispose();
      await closeAllEditorGroups();
    }
  });

  it('should not notify tab changes when a protected bulk close removes nothing', async () => {
    const pinned = new URI('test://pin/no-op-close');
    await editorService.open(pinned, { preview: false });
    const group = editorService.currentEditorGroup as EditorGroup;
    group.pinTab(pinned);
    const listener = jest.fn();
    const disposer = group.onDidEditorGroupTabChanged(listener);

    try {
      await group.closeAll();

      expect(listener).not.toHaveBeenCalled();
      expect(group.resources.map((resource) => resource.uri.toString())).toEqual([pinned.toString()]);
    } finally {
      disposer.dispose();
      await closeAllEditorGroups();
    }
  });

  it('should map forced workbench cleanup to closing pinned tabs', async () => {
    const pinned = new URI('test://pin/workbench-force');
    await editorService.open(pinned, { preview: false });
    const group = editorService.currentEditorGroup as EditorGroup;
    group.pinTab(pinned);

    try {
      await editorService.closeAll();
      expect(group.resources.map((resource) => resource.uri.toString())).toEqual([pinned.toString()]);
      expect(group.isPinned(pinned)).toBe(true);

      await editorService.closeAll(undefined, true);
      expect(group.resources).toHaveLength(0);
      expect(group.pinnedTabCount).toBe(0);
    } finally {
      await closeAllEditorGroups();
    }
  });

  it('should activate the first ordinary tab instead of closing an active pinned tab', async () => {
    const pinned = new URI('test://pin/active');
    const ordinary = new URI('test://pin/fallback');
    await editorService.open(pinned, { preview: false });
    await editorService.open(ordinary, { preview: false });
    const group = editorService.currentEditorGroup as EditorGroup;
    group.pinTab(pinned);
    await group.open(pinned, { focus: true });

    try {
      expect(typeof group.activateFirstUnpinned).toBe('function');
      expect(await group.activateFirstUnpinned()).toBe(true);
      expect(group.resources.map((resource) => resource.uri.toString())).toEqual([pinned, ordinary].map(String));
      expect(group.pinnedTabCount).toBe(1);
      expect(group.currentResource?.uri.toString()).toBe(ordinary.toString());

      await group.open(pinned, { focus: true });
      await group.close(ordinary, { force: true });
      expect(await group.activateFirstUnpinned()).toBe(false);
      expect(group.resources.map((resource) => resource.uri.toString())).toEqual([pinned.toString()]);
      expect(group.pinnedTabCount).toBe(1);
      expect(group.currentResource?.uri.toString()).toBe(pinned.toString());
    } finally {
      await closeAllEditorGroups();
    }
  });

  it('should preserve source pin state when dropping into an empty group', async () => {
    const uri = new URI('test://pin/drop-empty');
    await editorService.open(uri, { preview: false });
    const source = editorService.currentEditorGroup as EditorGroup;
    source.pinTab(uri);
    const target = (editorService as WorkbenchEditorServiceImpl).createEditorGroup();
    source.grid.split(SplitDirection.Horizontal, target);

    try {
      await target.dropUri(uri, DragOverPosition.CENTER, source);

      expect(target.resources.map((resource) => resource.uri.toString())).toEqual([uri.toString()]);
      expect(target.pinnedTabCount).toBe(1);
      expect(target.isPinned(uri)).toBe(true);
      expect(source.resources.some((resource) => resource.uri.isEqual(uri))).toBe(false);
    } finally {
      await closeAllEditorGroups();
    }
  });

  it('should retain the source tab when the target open fails', async () => {
    const sourceUri = new URI('test://pin/drop-failed-source');
    const targetUri = new URI('test://pin/drop-failed-target');
    await editorService.open(sourceUri, { preview: false });
    const source = editorService.currentEditorGroup as EditorGroup;
    await source.split(EditorGroupSplitAction.Right, targetUri, { focus: true });
    const target = editorService.editorGroups.find((group) => group !== source) as EditorGroup;
    const openSpy = jest.spyOn(target, 'open').mockResolvedValue(false);

    try {
      await target.dropUri(sourceUri, DragOverPosition.CENTER, source, target.resources[0]);

      expect(source.resources.some((resource) => resource.uri.isEqual(sourceUri))).toBe(true);
      expect(target.resources.some((resource) => resource.uri.isEqual(sourceUri))).toBe(false);
    } finally {
      openSpy.mockRestore();
      await closeAllEditorGroups();
    }
  });

  it('should preserve source pin state when dropping into a new split', async () => {
    const sourceUri = new URI('test://pin/drop-split-source');
    const targetUri = new URI('test://pin/drop-split-target');
    await editorService.open(sourceUri, { preview: false });
    const source = editorService.currentEditorGroup as EditorGroup;
    source.pinTab(sourceUri);
    await source.split(EditorGroupSplitAction.Right, targetUri, { focus: true });
    const target = editorService.editorGroups.find((group) => group !== source) as EditorGroup;

    try {
      await target.dropUri(sourceUri, DragOverPosition.RIGHT, source);
      const splitTarget = editorService.editorGroups.find(
        (group) =>
          group !== source && group !== target && group.resources.some((resource) => resource.uri.isEqual(sourceUri)),
      ) as EditorGroup;

      expect(splitTarget).toBeDefined();
      expect(splitTarget.isPinned(sourceUri)).toBe(true);
      expect(source.resources.some((resource) => resource.uri.isEqual(sourceUri))).toBe(false);
    } finally {
      await closeAllEditorGroups();
    }
  });

  it('should keep an ordinary source ordinary when edge-dropping from a group with the same URI pinned', async () => {
    const uri = new URI('test://pin/drop-split-duplicate');
    await editorService.open(uri, { preview: false });
    const source = editorService.currentEditorGroup as EditorGroup;
    await source.split(EditorGroupSplitAction.Right, uri, { focus: true });
    const receiving = editorService.editorGroups.find((group) => group !== source) as EditorGroup;
    receiving.pinTab(uri);

    try {
      expect(source.isPinned(uri)).toBe(false);
      expect(receiving.isPinned(uri)).toBe(true);

      await receiving.dropUri(uri, DragOverPosition.RIGHT, source);
      const splitTarget = editorService.editorGroups.find(
        (group) =>
          group !== source && group !== receiving && group.resources.some((resource) => resource.uri.isEqual(uri)),
      ) as EditorGroup;

      expect(splitTarget).toBeDefined();
      expect(splitTarget.pinnedTabCount).toBe(0);
      expect(splitTarget.isPinned(uri)).toBe(false);
      expect(source.resources.some((resource) => resource.uri.isEqual(uri))).toBe(false);
    } finally {
      await closeAllEditorGroups();
    }
  });

  it('should unpin a cross-group drop when targeting the ordinary region', async () => {
    const sourceUri = new URI('test://pin/cross-unpin-source');
    const targetPinnedUri = new URI('test://pin/cross-unpin-target-pinned');
    const targetOrdinaryUri = new URI('test://pin/cross-unpin-target-ordinary');
    await editorService.open(sourceUri, { preview: false });
    const source = editorService.currentEditorGroup as EditorGroup;
    source.pinTab(sourceUri);
    await source.split(EditorGroupSplitAction.Right, targetPinnedUri, { focus: true });
    const target = editorService.editorGroups.find((group) => group !== source) as EditorGroup;
    target.pinTab(targetPinnedUri);
    await target.open(targetOrdinaryUri, { preview: false });

    try {
      const targetOrdinary = target.resources.find((resource) => resource.uri.isEqual(targetOrdinaryUri));
      await target.dropUri(sourceUri, DragOverPosition.CENTER, source, targetOrdinary);

      expect(target.resources.map((resource) => resource.uri.toString())).toEqual(
        [targetPinnedUri, sourceUri, targetOrdinaryUri].map(String),
      );
      expect(target.pinnedTabCount).toBe(1);
      expect(target.isPinned(targetPinnedUri)).toBe(true);
      expect(target.isPinned(sourceUri)).toBe(false);
      expect(target.isPinned(targetOrdinaryUri)).toBe(false);
      expect(source.resources.some((resource) => resource.uri.isEqual(sourceUri))).toBe(false);
    } finally {
      await closeAllEditorGroups();
    }
  });

  it('should retain the source tab when an edge split fails', async () => {
    const sourceUri = new URI('test://pin/drop-failed-split-source');
    const targetUri = new URI('test://pin/drop-failed-split-target');
    await editorService.open(sourceUri, { preview: false });
    const source = editorService.currentEditorGroup as EditorGroup;
    await source.split(EditorGroupSplitAction.Right, targetUri, { focus: true });
    const target = editorService.editorGroups.find((group) => group !== source) as EditorGroup;
    const splitSpy = jest.spyOn(target, 'split').mockResolvedValue(false);

    try {
      await target.dropUri(sourceUri, DragOverPosition.RIGHT, source);

      expect(source.resources.some((resource) => resource.uri.isEqual(sourceUri))).toBe(true);
      expect(target.resources.some((resource) => resource.uri.isEqual(sourceUri))).toBe(false);
    } finally {
      splitSpy.mockRestore();
      await closeAllEditorGroups();
    }
  });

  it('should keep open a preview tab dragged into the pinned region', async () => {
    const pinnedUri = new URI('test://pin/drag-preview-pinned');
    const previewUri = new URI('test://pin/drag-preview');
    await editorService.open(pinnedUri, { preview: false });
    const group = editorService.currentEditorGroup as EditorGroup;
    group.pinTab(pinnedUri);
    await group.open(previewUri, { preview: true });

    try {
      expect(group.previewURI?.toString()).toBe(previewUri.toString());

      await group.dropUri(previewUri, DragOverPosition.CENTER, group, group.resources[0]);

      expect(group.resources.map((resource) => resource.uri.toString())).toEqual([previewUri, pinnedUri].map(String));
      expect(group.previewURI).toBeNull();
      expect(group.pinnedTabCount).toBe(2);
      expect(group.isPinned(previewUri)).toBe(true);
      expect(group.isPinned(pinnedUri)).toBe(true);
    } finally {
      await closeAllEditorGroups();
    }
  });

  it('replace should work properly', async () => {
    const testCodeUri = new URI('test://a/testUri1');
    await editorService.open(testCodeUri, { preview: false });
    const testCodeUri2 = new URI('test://a/testUri2');
    await editorService.open(testCodeUri2, { preview: false });
    const testCodeUri3 = new URI('test://a/testUri3');
    await editorService.open(testCodeUri3, { preview: false });

    await editorService.open(testCodeUri2, { preview: false });

    const testCodeUri4 = new URI('test://a/testUri4');
    await editorService.open(testCodeUri4, { preview: false, replace: true });

    expect(editorService.currentEditorGroup.resources.map((r) => r.uri.toString())).toEqual([
      'test://a/testUri1',
      'test://a/testUri4',
      'test://a/testUri3',
    ]);

    await editorService.open(testCodeUri2, { preview: false, replace: true, index: 0 });

    expect(editorService.currentEditorGroup.resources.map((r) => r.uri.toString())).toEqual([
      'test://a/testUri2',
      'test://a/testUri4',
      'test://a/testUri3',
    ]);

    // 不允许关闭的情况
    doNotClose.push(testCodeUri4.toString());

    const testCodeUri5 = new URI('test://a/testUri5');
    await editorService.open(testCodeUri5, { preview: false, replace: true, index: 1 });

    expect(editorService.currentEditorGroup.resources.map((r) => r.uri.toString())).toEqual([
      'test://a/testUri2',
      'test://a/testUri5',
      'test://a/testUri4',
      'test://a/testUri3',
    ]);

    doNotClose.splice(0, doNotClose.length);
    await editorService.closeAll();
  });

  it('closeOthers should notify tab changed', async () => {
    const testCodeUri = new URI('test://a/testUri1');
    await editorService.open(testCodeUri, { preview: false });
    const testCodeUri2 = new URI('test://a/testUri2');
    await editorService.open(testCodeUri2, { preview: false });
    const testCodeUri3 = new URI('test://a/testUri3');
    await editorService.open(testCodeUri3, { preview: false });

    const listener = jest.fn();
    const disposer = (editorService.currentEditorGroup as EditorGroup).onDidEditorGroupTabChanged(listener);

    await (editorService.currentEditorGroup as EditorGroup).closeOthers(testCodeUri2);

    expect(listener).toHaveBeenCalled();

    await editorService.closeAll();
    disposer.dispose();
  });

  it('close all tabs should emit EditorGroupChangeEvent', async () => {
    const testCodeUri = new URI('test://a/testUri1');
    await editorService.open(testCodeUri, { preview: false });
    const testCodeUri2 = new URI('test://a/testUri2');
    await editorService.open(testCodeUri2, { preview: false });
    const testCodeUri3 = new URI('test://a/testUri3');
    await editorService.open(testCodeUri3, { preview: false });

    const eventBus = injector.get(IEventBus);

    const listener = jest.fn();
    const disposer = eventBus.on(EditorGroupChangeEvent, listener);

    await editorService.closeAll();

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          newResource: null,
          oldResource: expect.anything(),
        }),
      }),
    );
    disposer.dispose();
  });

  it('close last tabs should emit EditorGroupChangeEvent', async () => {
    const testCodeUri = new URI('test://a/testUri1');
    await editorService.open(testCodeUri, { preview: false });

    const eventBus = injector.get(IEventBus);

    const listener = jest.fn();
    const disposer = eventBus.on(EditorGroupChangeEvent, listener);

    await editorService.close(testCodeUri);

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          newResource: null,
          oldResource: expect.anything(),
        }),
      }),
    );
    disposer.dispose();
  });

  it('side widget registration should be ok', () => {
    editorComponentRegistry.registerEditorSideWidget({
      component: () => null as any,
      id: 'test-1',
      displaysOnResource: (resource) => resource.uri.scheme === 'testScheme',
    });

    expect(editorComponentRegistry.getSideWidgets('bottom', { uri: new URI('testScheme://tes/t') } as any).length).toBe(
      1,
    );
    expect(
      editorComponentRegistry.getSideWidgets('bottom', { uri: new URI('testScheme2://tes/t') } as any).length,
    ).toBe(0);
  });

  afterAll(() => {
    disposer.dispose();
  });
});

describe('utils test', () => {
  it('util tests', () => {
    expect(isEditStack({ editOperations: [] } as any)).toBeTruthy();
    expect(isEditStack({} as any)).toBeFalsy();

    expect(isEOLStack({ eol: [] } as any)).toBeTruthy();
    expect(isEOLStack({} as any)).toBeFalsy();
  });

  it('save task', async () => {
    const service: any = {
      saveEditorDocumentModel: jest.fn((uri, content) => {
        if (content.indexOf('fail') > -1) {
          throw new Error('test fail');
        } else {
          return {
            state: 'success',
          };
        }
      }),
    };
    const saveTask1 = new SaveTask(new URI('file:///test/test.js'), 1, 1, 'test success', true);

    const res1 = await saveTask1.run(service, 'test begin', []);

    expect(res1.state).toBe('success');

    const saveTask2 = new SaveTask(new URI('file:///test/test.js'), 1, 1, 'test fail', true);
    const res2 = await saveTask2.run(service, 'test begin', []);

    expect(res2.state).toBe('error');
  });
});

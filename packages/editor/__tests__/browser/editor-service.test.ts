import { CorePreferences, IContextKeyService, PreferenceService } from '@opensumi/ide-core-browser';
import {
  URI,
  Disposable,
  createContributionProvider,
  ILoggerManagerClient,
  IEventBus,
} from '@opensumi/ide-core-common';
import {
  EditorComponentRegistry,
  IEditorDecorationCollectionService,
  IEditorDocumentModelContentRegistry,
  IEditorDocumentModelService,
  EmptyDocCacheImpl,
  IEditorFeatureRegistry,
  BrowserEditorContribution,
  EditorGroupChangeEvent,
  CodeEditorDidVisibleEvent,
} from '@opensumi/ide-editor/lib/browser';
import { EditorComponentRegistryImpl } from '@opensumi/ide-editor/lib/browser/component';
import { isEditStack, isEOLStack } from '@opensumi/ide-editor/lib/browser/doc-model/editor-is-fn';
import {
  EditorDocumentModelContentRegistryImpl,
  EditorDocumentModelServiceImpl,
  SaveTask,
} from '@opensumi/ide-editor/lib/browser/doc-model/main';
import { EditorCollectionServiceImpl } from '@opensumi/ide-editor/lib/browser/editor-collection.service';
import { EditorDecorationCollectionService } from '@opensumi/ide-editor/lib/browser/editor.decoration.service';
import { EditorFeatureRegistryImpl } from '@opensumi/ide-editor/lib/browser/feature';
import { LanguageService } from '@opensumi/ide-editor/lib/browser/language/language.service';
import { ResourceServiceImpl } from '@opensumi/ide-editor/lib/browser/resource.service';
import { WorkbenchEditorServiceImpl, EditorGroup } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';
import {
  EditorCollectionService,
  WorkbenchEditorService,
  ResourceService,
  ILanguageService,
  EditorGroupSplitAction,
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
  TestResourceProvider,
  TestResourceResolver,
  TestEditorDocumentProvider,
  TestResourceResolver2,
  TestResourceComponent,
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
      token: ILoggerManagerClient,
      useValue: jest.fn(),
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
  it('should be able to create and dispose editors', async (done) => {
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

    done();
  });
});

describe('workbench editor service tests', () => {
  // prepare
  const editorService: WorkbenchEditorService = injector.get(WorkbenchEditorService);

  const resourceService: ResourceService = injector.get(ResourceService);
  const editorComponentRegistry: EditorComponentRegistry = injector.get(EditorComponentRegistry);
  const editorDocModelRegistry: IEditorDocumentModelContentRegistry = injector.get(IEditorDocumentModelContentRegistry);
  const eventBus: IEventBus = injector.get(IEventBus);

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

  it('should be able to open uri', async (done) => {
    const testCodeUri = new URI('test://testUri1');
    const listener = jest.fn();
    const disposer = (editorService.currentEditorGroup as EditorGroup).onDidEditorGroupTabChanged(listener);

    await editorService.open(testCodeUri);

    expect(editorService.currentResource).toBeDefined();
    expect(editorService.currentResource!.uri.toString()).toBe(testCodeUri.toString());
    expect(listener).toBeCalled();

    await editorService.closeAll();
    disposer.dispose();
    done();
  });

  it('should be able to fire loading state for big resources', async (done) => {
    const listener = jest.fn();
    const testLoadingCodeUri = new URI('test://test/loading');
    const testCodeUri = new URI('test://testUri1');

    const disposer = editorService.currentEditorGroup.onDidEditorGroupContentLoading((resource) => {
      listener();
      const status = editorService.currentEditorGroup.resourceStatus.get(resource);
      expect(status).toBeDefined();
      status?.finally(async () => {
        disposer.dispose();
        await editorService.closeAll();
        done();
      });
    });

    await editorService.open(testCodeUri);
    await editorService.open(testLoadingCodeUri);
    expect(listener).toBeCalledTimes(1);
  });

  it('should be able to open component ', async (done) => {
    const testComponentUri = new URI('test://component');
    const listener = jest.fn();
    const disposer = (editorService.currentEditorGroup as EditorGroup).onDidEditorGroupBodyChanged(listener);

    await editorService.open(testComponentUri);
    expect(editorService.editorGroups[0].currentOpenType).toBeDefined();
    expect(editorService.editorGroups[0].currentOpenType!.type).toBe('component');
    expect(listener).toBeCalled();

    await editorService.closeAll();

    await editorService.open(testComponentUri, { preview: false, forceOpenType: { type: 'code' } });
    expect(editorService.editorGroups[0].currentOpenType).toBeDefined();
    expect(editorService.editorGroups[0].currentOpenType!.type).toBe('code');

    // 测试 getState 方法
    expect(editorService.editorGroups[0].getState()).toEqual({
      uris: ['test://component'],
      current: 'test://component',
      previewIndex: -1,
    });

    await editorService.closeAll();

    disposer.dispose();
    done();
  });

  it('should be able to split', async (done) => {
    const testCodeUri = new URI('test://testUri1');
    await editorService.open(testCodeUri);
    await editorService.open(testCodeUri, { split: EditorGroupSplitAction.Right });
    await editorService.open(testCodeUri, { split: EditorGroupSplitAction.Bottom });
    expect(editorService.editorGroups.length).toBe(3);

    await editorService.closeAll();
    done();
  });

  it('should focus editor', async (done) => {
    const testCodeUri = new URI('test:///testuri1');
    const focused = jest.fn();
    editorService.currentEditorGroup.codeEditor.monacoEditor.onDidFocusEditorText(focused);
    await editorService.open(testCodeUri, { focus: true });
    eventBus.fire(
      new CodeEditorDidVisibleEvent({
        groupName: editorService.currentEditorGroup.name,
        editorId: editorService.currentEditorGroup.codeEditor.getId(),
        type: 'code',
      }),
    );

    expect(focused).toBeCalled();

    await editorService.closeAll();
    done();
  });

  it('preview mode should work', async (done) => {
    const testCodeUri = new URI('test://testUri1');
    await editorService.open(testCodeUri, { preview: true });
    const testCodeUri2 = new URI('test://testUri2');
    await editorService.open(testCodeUri2, { preview: true });
    expect(editorService.editorGroups[0].resources.length).toBe(1);

    await editorService.closeAll();
    done();
  });

  it('pined mode should work', async (done) => {
    const testCodeUri = new URI('test://testUri1');
    await editorService.open(testCodeUri, { preview: false });
    const testCodeUri2 = new URI('test://testUri2');
    await editorService.open(testCodeUri2, { preview: false });
    expect(editorService.editorGroups[0].resources.length).toBe(2);

    await editorService.closeAll();
    done();
  });

  it('pined uri should be empty after close all', async (done) => {
    const testCodeUri = new URI('test://testUri1');
    await editorService.open(testCodeUri, { preview: true });
    await editorService.closeAll();
    expect((editorService as WorkbenchEditorServiceImpl).currentEditorGroup.previewURI).toBeNull();
    await editorService.open(testCodeUri, { preview: true });
    expect(editorService.editorGroups[0].resources.length).toBe(1);

    await editorService.closeAll();
    done();
  });

  it('replace should work properly', async (done) => {
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
    done();
  });

  it('closeOthers should notify tab changed', async (done) => {
    const testCodeUri = new URI('test://a/testUri1');
    await editorService.open(testCodeUri, { preview: false });
    const testCodeUri2 = new URI('test://a/testUri2');
    await editorService.open(testCodeUri2, { preview: false });
    const testCodeUri3 = new URI('test://a/testUri3');
    await editorService.open(testCodeUri3, { preview: false });

    const listener = jest.fn();
    const disposer = (editorService.currentEditorGroup as EditorGroup).onDidEditorGroupTabChanged(listener);

    await (editorService.currentEditorGroup as EditorGroup).closeOthers(testCodeUri2);

    expect(listener).toBeCalled();

    await editorService.closeAll();
    disposer.dispose();
    done();
  });

  it('close all tabs should emit EditorGroupChangeEvent', async (done) => {
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

    expect(listener).toBeCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          newResource: null,
          oldResource: expect.anything(),
        }),
      }),
    );
    disposer.dispose();
    done();
  });

  it('close last tabs should emit EditorGroupChangeEvent', async (done) => {
    const testCodeUri = new URI('test://a/testUri1');
    await editorService.open(testCodeUri, { preview: false });

    const eventBus = injector.get(IEventBus);

    const listener = jest.fn();
    const disposer = eventBus.on(EditorGroupChangeEvent, listener);

    await editorService.close(testCodeUri);

    expect(listener).toBeCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          newResource: null,
          oldResource: expect.anything(),
        }),
      }),
    );
    disposer.dispose();
    done();
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

  it('save task', async (done) => {
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
    done();
  });
});

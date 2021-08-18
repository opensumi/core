import * as monaco from '@ali/monaco-editor-core/esm/vs/editor/editor.api';
import { Emitter, IFileServiceClient, IEventBus, CommonServerPath, OS, IApplicationService } from '@ali/ide-core-common';
import { URI, IContextKeyService } from '@ali/ide-core-browser';
import { injectMockPreferences } from '@ali/ide-core-browser/__mocks__/preference';
import * as path from 'path';
import { RPCProtocol } from '@ali/ide-connection/lib/common/rpcProtocol';
import { ExtHostAPIIdentifier, MainThreadAPIIdentifier } from '@ali/ide-kaitian-extension/lib/common/vscode';
import * as types from '../../src/common/vscode/ext-types';
import { IDialogService } from '@ali/ide-overlay';
import { isEqual } from 'lodash';

import { ExtensionHostEditorService } from '../../src/hosted/api/vscode/editor/editor.host';
import { MainThreadEditorService } from '../../src/browser/vscode/api/main.thread.editor';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { WorkbenchEditorService, EditorCollectionService, ResourceService, ILanguageService, IDocPersistentCacheProvider } from '@ali/ide-editor/lib/common';
import { WorkbenchEditorServiceImpl, EditorGroup } from '@ali/ide-editor/lib/browser/workbench-editor.service';
import { IEditorDecorationCollectionService, IEditorDocumentModelContentRegistry, IEditorDocumentModelService, IEditorFeatureRegistry, EditorModule, EmptyDocCacheImpl, EditorPreferences } from '@ali/ide-editor/lib/browser';
import { EditorDecorationCollectionService } from '@ali/ide-editor/lib/browser/editor.decoration.service';
import { EditorCollectionServiceImpl } from '@ali/ide-editor/lib/browser/editor-collection.service';
import { ExtensionService } from '@ali/ide-kaitian-extension/lib/common';
import { ExtensionServiceImpl } from '@ali/ide-kaitian-extension/lib/browser/extension.service';
import { ExtensionDocumentDataManagerImpl } from '@ali/ide-kaitian-extension/lib/hosted/api/vscode/doc';
import { MainThreadExtensionDocumentData } from '@ali/ide-kaitian-extension/lib/browser/vscode/api/main.thread.doc';
import { EditorDocumentModelContentRegistryImpl, EditorDocumentModelServiceImpl } from '@ali/ide-editor/lib/browser/doc-model/main';
import { EditorFeatureRegistryImpl } from '@ali/ide-editor/lib/browser/feature';
import { EditorGroupChangeEvent, EditorVisibleChangeEvent, EditorGroupIndexChangedEvent, EditorSelectionChangeEvent } from '@ali/ide-editor/lib/browser/types';
import { MonacoService } from '@ali/ide-monaco';
import MonacoServiceImpl from '@ali/ide-monaco/lib/browser/monaco.service';
import { CorePreferences, MonacoOverrideServiceRegistry } from '@ali/ide-core-browser';
import { ResourceServiceImpl } from '@ali/ide-editor/lib/browser/resource.service';
import { LanguageService } from '@ali/ide-editor/lib/browser/language/language.service';
import { useMockStorage } from '@ali/ide-core-browser/__mocks__/storage';
import { IWorkspaceService } from '@ali/ide-workspace';
import { MockWorkspaceService } from '@ali/ide-workspace/lib/common/mocks';
import { BaseFileSystemEditorDocumentProvider } from '@ali/ide-editor/lib/browser/fs-resource/fs-editor-doc';
import { FileSystemResourceProvider } from '@ali/ide-editor/lib/browser/fs-resource/fs-resource';
import { MockFileServiceClient } from '@ali/ide-file-service/lib/common/mocks';
import { FileServiceContribution } from '@ali/ide-file-service/lib/browser/file-service-contribution';
import { TestEditorDocumentProvider, TestResourceResolver } from '../../../editor/__tests__/browser/test-providers';
import { EditorComponentRegistryImpl } from '@ali/ide-editor/lib/browser/component';
import { EditorComponentRegistry } from '@ali/ide-editor/lib/browser/types';
import { MockContextKeyService } from '../../../monaco/__mocks__/monaco.context-key.service';
import { IResource, IEditorOpenType } from '@ali/ide-editor';
import { IConfigurationService, IConfigurationChangeEvent, ConfigurationTarget } from '@ali/monaco-editor-core/esm/vs/platform/configuration/common/configuration';
import * as TypeConverts from '@ali/ide-kaitian-extension/lib/common/vscode/converter';
import { MonacoOverrideServiceRegistryImpl } from '@ali/ide-monaco/lib/browser/override.service.registry';

const emitterA = new Emitter<any>();
const emitterB = new Emitter<any>();

const mockClientA = {
  send: (msg) => emitterB.fire(msg),
  onMessage: emitterA.event,
};
const mockClientB = {
  send: (msg) => emitterA.fire(msg),
  onMessage: emitterB.event,
};

const rpcProtocolExt = new RPCProtocol(mockClientA);
const rpcProtocolMain = new RPCProtocol(mockClientB);
const preferences: Map<string, any> = new Map();
const emitter = new Emitter<IConfigurationChangeEvent>();

const mockConfigurationService: any = {
  onDidChangeConfiguration: emitter.event,
  getValue: (k) => {
    return preferences.get(k);
  },
  setValue: (k, v) => {
    emitter.fire({
      source: ConfigurationTarget.USER,
      affectedKeys: [k],
      change: {
        keys: [k],
        overrides: [],
      },
      affectsConfiguration: (() => {}) as any,
      sourceConfig: {},
    });
    preferences.set(k, v);
  },
};

describe('MainThreadEditor Test Suites', () => {
  let injector;
  let extEditor: ExtensionHostEditorService;
  let workbenchEditorService: WorkbenchEditorService;
  let eventBus: IEventBus;
  let monacoservice: MonacoService;

  const disposables: types.OutputChannel[] = [];
  beforeAll(async (done) => {
    injector = createBrowserInjector([EditorModule]);
    injector.addProviders(...[
      FileServiceContribution,
      {
        token: WorkbenchEditorService,
        useClass: WorkbenchEditorServiceImpl,
      }, {
        token: IEditorDecorationCollectionService,
        useClass: EditorDecorationCollectionService,
      }, {
        token: ResourceService,
        useClass: ResourceServiceImpl,
      }, {
        token: IConfigurationService,
        useValue: mockConfigurationService,
      }, {
        token: EditorCollectionService,
        useClass: EditorCollectionServiceImpl,
      }, {
        token: ExtensionService,
        useClass: ExtensionServiceImpl,
      }, {
        token: IEditorDocumentModelContentRegistry,
        useClass: EditorDocumentModelContentRegistryImpl,
      }, {
        token: IEditorDocumentModelService,
        useClass: EditorDocumentModelServiceImpl,
      }, {
        token: IEditorFeatureRegistry,
        useClass: EditorFeatureRegistryImpl,
      }, {
        token: ILanguageService,
        useClass: LanguageService,
      }, {
        token: MonacoService,
        useClass: MonacoServiceImpl,
      }, {
        token: IDocPersistentCacheProvider,
        useClass: EmptyDocCacheImpl,
      }, {
        token: IWorkspaceService,
        useClass: MockWorkspaceService,
      }, {
        token: EditorComponentRegistry,
        useClass: EditorComponentRegistryImpl,
      }, {
        token: BaseFileSystemEditorDocumentProvider,
        useClass: BaseFileSystemEditorDocumentProvider,
      }, {
        token: IFileServiceClient,
        useClass: MockFileServiceClient,
      }, {
        token: IDialogService,
        useValue: {},
      }, {
        token: IContextKeyService,
        useClass: MockContextKeyService,
      }, {
        token: MonacoOverrideServiceRegistry,
        useClass: MonacoOverrideServiceRegistryImpl,
      }, {
        token: CommonServerPath,
        useValue: {
          getBackendOS: () => Promise.resolve(OS.type()),
        },
      }]);
    useMockStorage(injector);
    injectMockPreferences(injector);

    injector.overrideProviders({
      token: CorePreferences,
      useValue: {
        'files.encoding': 'utf8',
        'files.eol': 'auto',
      },
    });
    injector.overrideProviders({
      token: EditorPreferences,
      useValue: {
        'editor.previewMode': true,
      },
    });
    monacoservice = injector.get(MonacoService);
    await monacoservice.loadMonaco();
    workbenchEditorService = injector.get(WorkbenchEditorService);
    const extHostDocs = rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostDocuments, new ExtensionDocumentDataManagerImpl(rpcProtocolExt));
    extEditor = new ExtensionHostEditorService(rpcProtocolExt, extHostDocs);
    rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostEditors, extEditor);
    const MainThreadExtensionDocumentDataAPI = injector.get(MainThreadExtensionDocumentData, [rpcProtocolMain]);
    rpcProtocolMain.set(MainThreadAPIIdentifier.MainThreadEditors, injector.get(MainThreadEditorService, [rpcProtocolMain, MainThreadExtensionDocumentDataAPI]));
    const modelContentRegistry: IEditorDocumentModelContentRegistry = injector.get(IEditorDocumentModelContentRegistry);
    modelContentRegistry.registerEditorDocumentModelContentProvider(TestEditorDocumentProvider);
    const componentRegistry: EditorComponentRegistry = injector.get(EditorComponentRegistry);
    modelContentRegistry.registerEditorDocumentModelContentProvider(injector.get(BaseFileSystemEditorDocumentProvider));
    componentRegistry.registerEditorComponentResolver('file', TestResourceResolver);
    const resourceService: ResourceService = injector.get(ResourceService);
    resourceService.registerResourceProvider(injector.get(FileSystemResourceProvider));
    const extensionService: ExtensionService = injector.get(ExtensionService);
    const globalContextKeyService: IContextKeyService = injector.get(IContextKeyService);
    const editorContextKeyService = globalContextKeyService.createScoped();
    workbenchEditorService.setEditorContextKeyService(editorContextKeyService);
    (workbenchEditorService as WorkbenchEditorServiceImpl).prepareContextKeyService();
    extensionService.eagerExtensionsActivated.resolve();
    eventBus = injector.get(IEventBus);
    (workbenchEditorService as any).contributionsReady.resolve();

    // IApplicationService 不知道从哪里引入的，没法 overrideProvider 一个 mock 的实现..
    await injector.get(IApplicationService).initializeData();
    done();
  });

  afterAll(() => {
    for (const disposable of disposables) {
      disposable.dispose();
    }
  });

  it('should be able to get activeTextEditor and receive texteditor changed event', async (done) => {
    const group: EditorGroup = (workbenchEditorService as any).createEditorGroup();
    const editorDocModelService: IEditorDocumentModelService = injector.get(IEditorDocumentModelService);
    const resource: IResource = {
      name: 'test-file',
      uri: URI.file(path.join(__dirname, 'main.thread.output.test.ts')),
      icon: 'file',
    };
    const disposer = extEditor.onDidChangeActiveTextEditor((e) => {
      if (!!e) {
        expect(extEditor.activeEditor?.textEditor).toBeDefined();
        expect(extEditor.activeEditor?.textEditor.document.fileName).toBe(path.join(__dirname, 'main.thread.output.test.ts'));
        expect(e).toBeDefined();
        done();
        disposer.dispose();
      }
    });
    await group.createEditor(document.createElement('div'));
    const ref = await editorDocModelService.createModelReference(URI.file(path.join(__dirname, 'main.thread.output.test.ts')));
    await group.codeEditor.open(ref);
    const openType: IEditorOpenType = {
      type: 'code',
      componentId: 'test-v-component',
      title: 'test-file',
    };
    (workbenchEditorService as WorkbenchEditorServiceImpl).setCurrentGroup(group);
    group._currentOpenType = openType;
    group._currentResource = resource;
    eventBus.fire(new EditorGroupChangeEvent({
      group,
      newOpenType: group.currentOpenType,
      newResource: group.currentResource,
      oldOpenType: null,
      oldResource: null,
    }));
    group._onDidEditorGroupBodyChanged.fire();
  });

  it('should be able to get visibleTextEditors', async () => {
    const visibleTextEditors = extEditor.visibleEditors;
    expect(visibleTextEditors.length).toBe(1);
  });

  it('should receive Selectionchanged event when editor selection is changed', async (done) => {
    const resource: IResource = {
      name: 'test-file',
      uri: URI.file(path.join(__dirname, 'main.thread.output.test1.ts')),
      icon: 'file',
    };
    const selection = {
      selectionStartLineNumber: 1,
      selectionStartColumn: 1,
      positionLineNumber: 3,
      positionColumn: 10,
    };
    eventBus.fire(new EditorSelectionChangeEvent({
      group: workbenchEditorService.currentEditorGroup,
      resource: workbenchEditorService.currentResource as IResource || resource,
      selections: [
        new monaco.Selection(1, 1, 3, 10),
      ],
      source: 'test',
      editorUri: resource.uri,
    }));
    const disposer = extEditor.onDidChangeTextEditorSelection((e) => {
      disposer.dispose();
      expect(e.selections.length).toBe(1);
      expect(e.selections[0]).toBeDefined();
      expect(isEqual(TypeConverts.Selection.from(e.selections[0]), selection)).toBeTruthy();
      done();
    });
  });

  it('should receive onDidChangeTextEditorVisibleRanges event when editor visible range has changed', async (done) => {
    const resource: IResource = {
      name: 'test-file',
      uri: URI.file(path.join(__dirname, 'main.thread.output.test2.ts')),
      icon: 'file',
    };
    const range = {
      startLineNumber: 1,
      startColumn: 12,
      endLineNumber: 1,
      endColumn: 12,
    };
    eventBus.fire(new EditorVisibleChangeEvent({
      group: workbenchEditorService.currentEditorGroup,
      resource: workbenchEditorService.currentResource as IResource || resource,
      visibleRanges: [
        new monaco.Range(1, 12, 1, 12),
      ],
    }));
    const disposer = extEditor.onDidChangeTextEditorVisibleRanges((e) => {
      disposer.dispose();
      const converted = e.visibleRanges.map((v) => TypeConverts.Range.from(v));
      expect(converted.length).toBe(1);
      expect(converted[0]).toEqual(range);
      done();
    });
  });

  // FIXME 暂时跑不通
  it.skip('should receive onDidChangeTextEditorViewColumn event when editor view column has changed', async (done) => {
    eventBus.fire(new EditorGroupIndexChangedEvent({ group: workbenchEditorService.currentEditorGroup, index: 1 }));
    extEditor.onDidChangeTextEditorViewColumn((e) => {
      expect(e.viewColumn).toBe(2);
      done();
    });
  });

  it.skip('should receive TextEditorOptions changed event.', async (done) => {
    const modelOptions: monaco.editor.ITextModelUpdateOptions = {
      tabSize: 8,
      indentSize: 8,
      insertSpaces: true,
    };
    workbenchEditorService.currentEditor?.updateOptions({}, modelOptions);
    extEditor.onDidChangeTextEditorOptions((e) => {
      // FIXME 似乎 modelOptions 没有更新到
      expect(e.options).toBeDefined();
      done();
    });
  });

  it('should be able to insert snippet', async (done) => {
    const snippetString = new types.SnippetString(`
      import * as React from 'react';
    `);
    await extEditor.activeEditor?.textEditor.insertSnippet(snippetString);
    done();
  });

  it('should be able to edit document', async (done) => {
    await extEditor.activeEditor?.textEditor.edit((builder) => {
      builder.insert(new types.Position(1, 1), 'hello');
    });
    expect(extEditor.activeEditor?.textEditor.document.getText()).toBe(workbenchEditorService.currentEditor?.monacoEditor.getValue());
    done();
  });

  it('should receive undefined when close all editor', async (done) => {
    extEditor.onDidChangeVisibleTextEditors((e) => {
      expect(e.length).toBe(0);
    });
    extEditor.onDidChangeActiveTextEditor((e) => {
      expect(e).toBeUndefined();
      done();
    });
    await workbenchEditorService.closeAll();
  });
});

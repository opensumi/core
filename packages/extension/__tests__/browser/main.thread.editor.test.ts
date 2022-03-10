import path from 'path';

import { isEqual } from 'lodash';

import { RPCProtocol } from '@opensumi/ide-connection/lib/common/rpcProtocol';
import { URI, IContextKeyService } from '@opensumi/ide-core-browser';
import { CorePreferences, MonacoOverrideServiceRegistry } from '@opensumi/ide-core-browser';
import { injectMockPreferences } from '@opensumi/ide-core-browser/__mocks__/preference';
import { useMockStorage } from '@opensumi/ide-core-browser/__mocks__/storage';
import {
  Emitter,
  IFileServiceClient,
  IEventBus,
  CommonServerPath,
  OS,
  IApplicationService,
} from '@opensumi/ide-core-common';
import { IResource, IEditorOpenType } from '@opensumi/ide-editor';
import {
  IEditorDecorationCollectionService,
  IEditorDocumentModelContentRegistry,
  IEditorDocumentModelService,
  IEditorFeatureRegistry,
  EditorModule,
  EmptyDocCacheImpl,
  EditorPreferences,
} from '@opensumi/ide-editor/lib/browser';
import { EditorComponentRegistryImpl } from '@opensumi/ide-editor/lib/browser/component';
import {
  EditorDocumentModelContentRegistryImpl,
  EditorDocumentModelServiceImpl,
} from '@opensumi/ide-editor/lib/browser/doc-model/main';
import { EditorCollectionServiceImpl } from '@opensumi/ide-editor/lib/browser/editor-collection.service';
import { EditorDecorationCollectionService } from '@opensumi/ide-editor/lib/browser/editor.decoration.service';
import { EditorFeatureRegistryImpl } from '@opensumi/ide-editor/lib/browser/feature';
import { BaseFileSystemEditorDocumentProvider } from '@opensumi/ide-editor/lib/browser/fs-resource/fs-editor-doc';
import { FileSystemResourceProvider } from '@opensumi/ide-editor/lib/browser/fs-resource/fs-resource';
import { LanguageService } from '@opensumi/ide-editor/lib/browser/language/language.service';
import { ResourceServiceImpl } from '@opensumi/ide-editor/lib/browser/resource.service';
import { EditorComponentRegistry } from '@opensumi/ide-editor/lib/browser/types';
import {
  EditorGroupChangeEvent,
  EditorVisibleChangeEvent,
  EditorGroupIndexChangedEvent,
  EditorSelectionChangeEvent,
} from '@opensumi/ide-editor/lib/browser/types';
import { WorkbenchEditorServiceImpl, EditorGroup } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';
import {
  WorkbenchEditorService,
  EditorCollectionService,
  ResourceService,
  ILanguageService,
  IDocPersistentCacheProvider,
} from '@opensumi/ide-editor/lib/common';
import { ExtensionServiceImpl } from '@opensumi/ide-extension/lib/browser/extension.service';
import { MainThreadExtensionDocumentData } from '@opensumi/ide-extension/lib/browser/vscode/api/main.thread.doc';
import { ExtensionService } from '@opensumi/ide-extension/lib/common';
import { ExtHostAPIIdentifier, MainThreadAPIIdentifier } from '@opensumi/ide-extension/lib/common/vscode';
import * as TypeConverts from '@opensumi/ide-extension/lib/common/vscode/converter';
import { ExtensionDocumentDataManagerImpl } from '@opensumi/ide-extension/lib/hosted/api/vscode/doc';
import { FileServiceContribution } from '@opensumi/ide-file-service/lib/browser/file-service-contribution';
import { MockFileServiceClient } from '@opensumi/ide-file-service/lib/common/mocks';
import { MonacoService } from '@opensumi/ide-monaco';
import MonacoServiceImpl from '@opensumi/ide-monaco/lib/browser/monaco.service';
import { MonacoOverrideServiceRegistryImpl } from '@opensumi/ide-monaco/lib/browser/override.service.registry';
import { IDialogService } from '@opensumi/ide-overlay';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { MockWorkspaceService } from '@opensumi/ide-workspace/lib/common/mocks';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';
import {
  IConfigurationService,
  IConfigurationChangeEvent,
  ConfigurationTarget,
} from '@opensumi/monaco-editor-core/esm/vs/platform/configuration/common/configuration';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { TestEditorDocumentProvider, TestResourceResolver } from '../../../editor/__tests__/browser/test-providers';
import { MockContextKeyService } from '../../../monaco/__mocks__/monaco.context-key.service';
import { MainThreadEditorService } from '../../src/browser/vscode/api/main.thread.editor';
import * as types from '../../src/common/vscode/ext-types';
import { ExtensionHostEditorService } from '../../src/hosted/api/vscode/editor/editor.host';

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
  getValue: (k) => preferences.get(k),
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
    injector.addProviders(
      ...[
        FileServiceContribution,
        {
          token: WorkbenchEditorService,
          useClass: WorkbenchEditorServiceImpl,
        },
        {
          token: IEditorDecorationCollectionService,
          useClass: EditorDecorationCollectionService,
        },
        {
          token: ResourceService,
          useClass: ResourceServiceImpl,
        },
        {
          token: IConfigurationService,
          useValue: mockConfigurationService,
        },
        {
          token: EditorCollectionService,
          useClass: EditorCollectionServiceImpl,
        },
        {
          token: ExtensionService,
          useClass: ExtensionServiceImpl,
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
          token: IEditorFeatureRegistry,
          useClass: EditorFeatureRegistryImpl,
        },
        {
          token: ILanguageService,
          useClass: LanguageService,
        },
        {
          token: MonacoService,
          useClass: MonacoServiceImpl,
        },
        {
          token: IDocPersistentCacheProvider,
          useClass: EmptyDocCacheImpl,
        },
        {
          token: IWorkspaceService,
          useClass: MockWorkspaceService,
        },
        {
          token: EditorComponentRegistry,
          useClass: EditorComponentRegistryImpl,
        },
        {
          token: BaseFileSystemEditorDocumentProvider,
          useClass: BaseFileSystemEditorDocumentProvider,
        },
        {
          token: IFileServiceClient,
          useClass: MockFileServiceClient,
        },
        {
          token: IDialogService,
          useValue: {},
        },
        {
          token: IContextKeyService,
          useClass: MockContextKeyService,
        },
        {
          token: MonacoOverrideServiceRegistry,
          useClass: MonacoOverrideServiceRegistryImpl,
        },
        {
          token: CommonServerPath,
          useValue: {
            getBackendOS: () => Promise.resolve(OS.type()),
          },
        },
      ],
    );
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
    const extHostDocs = rpcProtocolExt.set(
      ExtHostAPIIdentifier.ExtHostDocuments,
      new ExtensionDocumentDataManagerImpl(rpcProtocolExt),
    );
    extEditor = new ExtensionHostEditorService(rpcProtocolExt, extHostDocs);
    rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostEditors, extEditor);
    const MainThreadExtensionDocumentDataAPI = injector.get(MainThreadExtensionDocumentData, [rpcProtocolMain]);
    rpcProtocolMain.set(
      MainThreadAPIIdentifier.MainThreadEditors,
      injector.get(MainThreadEditorService, [rpcProtocolMain, MainThreadExtensionDocumentDataAPI]),
    );
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
      if (e) {
        expect(extEditor.activeEditor?.textEditor).toBeDefined();
        expect(extEditor.activeEditor?.textEditor.document.fileName).toBe(
          path.join(__dirname, 'main.thread.output.test.ts'),
        );
        expect(e).toBeDefined();
        done();
        disposer.dispose();
      }
    });
    await group.createEditor(document.createElement('div'));
    const ref = await editorDocModelService.createModelReference(
      URI.file(path.join(__dirname, 'main.thread.output.test.ts')),
    );
    await group.codeEditor.open(ref);
    const openType: IEditorOpenType = {
      type: 'code',
      componentId: 'test-v-component',
      title: 'test-file',
    };
    (workbenchEditorService as WorkbenchEditorServiceImpl).setCurrentGroup(group);
    group._currentOpenType = openType;
    group._currentResource = resource;
    eventBus.fire(
      new EditorGroupChangeEvent({
        group,
        newOpenType: group.currentOpenType,
        newResource: group.currentResource,
        oldOpenType: null,
        oldResource: null,
      }),
    );
    group._onDidEditorGroupBodyChanged.fire();
    group._onDidEditorFocusChange.fire();
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
    eventBus.fire(
      new EditorSelectionChangeEvent({
        group: workbenchEditorService.currentEditorGroup,
        resource: (workbenchEditorService.currentResource as IResource) || resource,
        selections: [new monaco.Selection(1, 1, 3, 10)],
        source: 'test',
        editorUri: resource.uri,
      }),
    );
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
    eventBus.fire(
      new EditorVisibleChangeEvent({
        group: workbenchEditorService.currentEditorGroup,
        resource: (workbenchEditorService.currentResource as IResource) || resource,
        visibleRanges: [new monaco.Range(1, 12, 1, 12)],
        editorUri: workbenchEditorService.currentResource!.uri!,
      }),
    );
    const disposer = extEditor.onDidChangeTextEditorVisibleRanges((e) => {
      disposer.dispose();
      const converted = e.visibleRanges.map((v) => TypeConverts.Range.from(v));
      expect(converted.length).toBe(1);
      expect(converted[0]).toEqual(range);
      done();
    });
  });

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
      expect(e.options).toBeDefined();
      done();
    });
  });

  it('should be able to insert snippet', async (done) => {
    const snippetString = new types.SnippetString(`
      import React from 'react';
    `);
    await extEditor.activeEditor?.textEditor.insertSnippet(snippetString);
    done();
  });

  it('should be able to edit document', async (done) => {
    await extEditor.activeEditor?.textEditor.edit((builder) => {
      builder.insert(new types.Position(1, 1), 'hello');
    });
    expect(extEditor.activeEditor?.textEditor.document.getText()).toBe(
      workbenchEditorService.currentEditor?.monacoEditor.getValue(),
    );
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

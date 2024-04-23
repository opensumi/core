import path from 'path';

import isEqual from 'lodash/isEqual';

import { CorePreferences, IContextKeyService, MonacoOverrideServiceRegistry, URI } from '@opensumi/ide-core-browser';
import { injectMockPreferences } from '@opensumi/ide-core-browser/__mocks__/preference';
import { useMockStorage } from '@opensumi/ide-core-browser/__mocks__/storage';
import {
  CommonServerPath,
  Deferred,
  Emitter,
  IApplicationService,
  IEventBus,
  OS,
  sleep,
} from '@opensumi/ide-core-common';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { IEditorOpenType, IResource } from '@opensumi/ide-editor';
import {
  TestEditorDocumentProvider,
  TestResourceResolver,
} from '@opensumi/ide-editor/__tests__/browser/test-providers';
import {
  EditorModule,
  EditorPreferences,
  EmptyDocCacheImpl,
  IEditorDecorationCollectionService,
  IEditorDocumentModelContentRegistry,
  IEditorDocumentModelService,
  IEditorFeatureRegistry,
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
import {
  EditorComponentRegistry,
  EditorGroupChangeEvent,
  EditorGroupIndexChangedEvent,
  EditorOpenType,
  EditorSelectionChangeEvent,
  EditorVisibleChangeEvent,
} from '@opensumi/ide-editor/lib/browser/types';
import { EditorGroup, WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';
import {
  EditorCollectionService,
  IDocPersistentCacheProvider,
  ILanguageService,
  ResourceService,
  WorkbenchEditorService,
} from '@opensumi/ide-editor/lib/common';
import { ExtensionServiceImpl } from '@opensumi/ide-extension/lib/browser/extension.service';
import { MainThreadExtensionDocumentData } from '@opensumi/ide-extension/lib/browser/vscode/api/main.thread.doc';
import { ExtensionService } from '@opensumi/ide-extension/lib/common';
import { ExtHostAPIIdentifier, MainThreadAPIIdentifier } from '@opensumi/ide-extension/lib/common/vscode';
import * as TypeConverts from '@opensumi/ide-extension/lib/common/vscode/converter';
import { ExtensionDocumentDataManagerImpl } from '@opensumi/ide-extension/lib/hosted/api/vscode/doc';
import { MockFileServiceClient } from '@opensumi/ide-file-service/__mocks__/file-service-client';
import { FileServiceContribution } from '@opensumi/ide-file-service/lib/browser/file-service-contribution';
import { IFileServiceClient } from '@opensumi/ide-file-service/lib/common';
import { MonacoService } from '@opensumi/ide-monaco';
import * as monaco from '@opensumi/ide-monaco';
import { MockContextKeyService } from '@opensumi/ide-monaco/__mocks__/monaco.context-key.service';
import MonacoServiceImpl from '@opensumi/ide-monaco/lib/browser/monaco.service';
import { MonacoOverrideServiceRegistryImpl } from '@opensumi/ide-monaco/lib/browser/override.service.registry';
import { IDialogService } from '@opensumi/ide-overlay';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { MockWorkspaceService } from '@opensumi/ide-workspace/lib/common/mocks';
import {
  ConfigurationTarget,
  IConfigurationChangeEvent,
  IConfigurationService,
} from '@opensumi/monaco-editor-core/esm/vs/platform/configuration/common/configuration';

import { createMockPairRPCProtocol } from '../../__mocks__/initRPCProtocol';
import { MainThreadEditorService } from '../../src/browser/vscode/api/main.thread.editor';
import * as types from '../../src/common/vscode/ext-types';
import { ExtensionHostEditorService } from '../../src/hosted/api/vscode/editor/editor.host';

const { rpcProtocolExt, rpcProtocolMain } = createMockPairRPCProtocol();

const preferences: Map<string, any> = new Map();
const emitter = new Emitter<IConfigurationChangeEvent>();

const mockConfigurationService: any = {
  onDidChangeConfiguration: emitter.event,
  getValue: (k) => preferences.get(k),
  setValue: (k, v) => {
    emitter.fire({
      source: ConfigurationTarget.USER,
      affectedKeys: new Set(k),
      change: {
        keys: [k],
        overrides: [],
      },
      affectsConfiguration: (() => {}) as any,
    });
    preferences.set(k, v);
  },
};

describe('MainThreadEditor Test Suites', () => {
  let injector;
  let extEditor: ExtensionHostEditorService;
  let workbenchEditorService: WorkbenchEditorService;
  let eventBus: IEventBus;

  const disposables: types.OutputChannel[] = [];
  beforeAll(async () => {
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
  });

  afterAll(() => {
    for (const disposable of disposables) {
      disposable.dispose();
    }
  });

  it('should be able to get activeTextEditor and receive texteditor changed event', async () => {
    const defered = new Deferred();

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
        disposer.dispose();
        defered.resolve();
      }
    });
    await group.createEditor(document.createElement('div'));
    const ref = await editorDocModelService.createModelReference(
      URI.file(path.join(__dirname, 'main.thread.output.test.ts')),
    );
    group.codeEditor.open(ref);
    const openType: IEditorOpenType = {
      type: EditorOpenType.code,
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

    await defered.promise;
  });

  it('should be able to get visibleTextEditors', async () => {
    const visibleTextEditors = extEditor.visibleEditors;
    expect(visibleTextEditors.length).toBe(1);
  });

  it('should receive Selectionchanged event when editor selection is changed', async () => {
    const disposer = extEditor.onDidChangeTextEditorSelection((e) => {
      expect(e.selections.length).toBe(1);
      expect(e.selections[0]).toBeDefined();
      expect(isEqual(TypeConverts.Selection.from(e.selections[0]), selection)).toBeTruthy();
      disposer.dispose();
    });
    const editorDocModelService: IEditorDocumentModelService = injector.get(IEditorDocumentModelService);
    await editorDocModelService.createModelReference(URI.file(path.join(__dirname, 'main.thread.output.test1.ts')));
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

    eventBus.fire(
      new EditorGroupChangeEvent({
        group: workbenchEditorService.currentEditorGroup,
        newOpenType: workbenchEditorService.currentEditorGroup.currentOpenType,
        newResource: resource,
        oldOpenType: null,
        oldResource: null,
      }),
    );
  });

  it(
    'should receive onDidChangeTextEditorVisibleRanges event when editor visible range has changed',
    async () => {
      const editorDocModelService: IEditorDocumentModelService = injector.get(IEditorDocumentModelService);
      await editorDocModelService.createModelReference(URI.file(path.join(__dirname, 'main.thread.output.test2.ts')));

      const resource: IResource = {
        name: 'test-file1',
        uri: URI.file(path.join(__dirname, 'main.thread.output.test2.ts')),
        icon: 'file',
      };

      const defered = new Deferred<void>();
      const disposer = extEditor.onDidChangeTextEditorVisibleRanges((e) => {
        // e.payload.uri 是 mock 的，这里用 textEditor.id 来判断
        if (!(e.textEditor as any).id.includes(resource.uri.toString())) {
          return;
        }

        disposer.dispose();
        const converted = e.visibleRanges.map((v) => TypeConverts.Range.from(v));
        expect(converted.length).toBe(1);
        expect(converted[0]).toEqual({
          startLineNumber: 1,
          startColumn: 12,
          endLineNumber: 1,
          endColumn: 12,
        });

        defered.resolve();
      });

      eventBus.fire(
        new EditorGroupChangeEvent({
          group: workbenchEditorService.currentEditorGroup,
          newOpenType: workbenchEditorService.currentEditorGroup.currentOpenType,
          newResource: resource,
          oldOpenType: null,
          oldResource: null,
        }),
      );

      await sleep(3 * 1000);

      eventBus.fire(
        new EditorVisibleChangeEvent({
          group: workbenchEditorService.currentEditorGroup,
          resource,
          visibleRanges: [new monaco.Range(1, 12, 1, 12)],
          editorUri: resource.uri,
        }),
      );

      await defered.promise;
    },
    10 * 1000,
  );

  it.skip('should receive onDidChangeTextEditorViewColumn event when editor view column has changed', (done) => {
    extEditor.onDidChangeTextEditorViewColumn((e) => {
      expect(e.viewColumn).toBe(2);
      done();
    });
    eventBus.fire(new EditorGroupIndexChangedEvent({ group: workbenchEditorService.currentEditorGroup, index: 1 }));
  });

  it.skip('should receive TextEditorOptions changed event.', (done) => {
    const modelOptions: monaco.editor.ITextModelUpdateOptions = {
      tabSize: 8,
      indentSize: 8,
      insertSpaces: true,
    };
    extEditor.onDidChangeTextEditorOptions((e) => {
      expect(e.options).toBeDefined();
      done();
    });
    workbenchEditorService.currentEditor?.updateOptions({}, modelOptions);
  });

  it('should be able to insert snippet', async () => {
    const snippetString = new types.SnippetString(`
      import React from 'react';
    `);
    await extEditor.activeEditor?.textEditor.insertSnippet(snippetString);
  });

  it('should be able to edit document', async () => {
    await extEditor.activeEditor?.textEditor.edit((builder) => {
      builder.insert(new types.Position(1, 1), 'hello');
    });
    expect(extEditor.activeEditor?.textEditor.document.getText()).toBe(
      workbenchEditorService.currentEditor?.monacoEditor.getValue(),
    );
  });

  it('should receive undefined when close all editor', (done) => {
    extEditor.onDidChangeVisibleTextEditors((e) => {
      expect(e.length).toBe(0);
    });
    extEditor.onDidChangeActiveTextEditor((e) => {
      expect(e).toBeUndefined();
      done();
    });
    workbenchEditorService.closeAll();
  });
});

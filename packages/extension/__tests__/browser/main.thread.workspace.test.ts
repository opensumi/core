import { ExtHostFileSystemInfo } from '../../src/hosted/api/vscode/ext.host.file-system-info';
import {
  Uri as vscodeUri,
  Emitter,
  IFileServiceClient,
  URI,
  Uri,
  IEventBus,
  PreferenceScope,
  ILoggerManagerClient,
  FileUri,
  CommonServerPath,
  OS,
  IApplicationService,
  DisposableCollection,
} from '@opensumi/ide-core-common';
import { MockInjector, mockService } from '../../../../tools/dev-tool/src/mock-injector';
import path from 'path';
import fs from 'fs';
import os from 'os';
import util from 'util';
import { RPCProtocol } from '@opensumi/ide-connection/lib/common/rpcProtocol';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MainThreadWorkspace } from '../../src/browser/vscode/api/main.thread.workspace';
import { ExtHostWorkspace, createWorkspaceApiFactory } from '../../src/hosted/api/vscode/ext.host.workspace';
import { ExtHostAPIIdentifier, MainThreadAPIIdentifier } from '@opensumi/ide-extension/lib/common/vscode';
import { ExtHostMessage } from '@opensumi/ide-extension/lib/hosted/api/vscode/ext.host.message';
import { ExtensionDocumentDataManagerImpl } from '@opensumi/ide-extension/lib/hosted/api/vscode/doc';
import { ExtHostPreference } from '@opensumi/ide-extension/lib/hosted/api/vscode/ext.host.preference';
import { ExtHostFileSystem } from '@opensumi/ide-extension/lib/hosted/api/vscode/ext.host.file-system';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { IDocPersistentCacheProvider, ResourceService } from '@opensumi/ide-editor/lib/common';
import {
  FileServiceClient,
  BrowserFileSystemRegistryImpl,
} from '@opensumi/ide-file-service/lib/browser/file-service-client';
import {
  FileServicePath,
  FileStat,
  FileType,
  IBrowserFileSystemRegistry,
  IDiskFileProvider,
} from '@opensumi/ide-file-service';
import { FileService, FileSystemNodeOptions } from '@opensumi/ide-file-service/lib/node';
import { ExtensionStorageModule } from '@opensumi/ide-extension-storage/lib/browser';
import { ExtensionService } from '@opensumi/ide-extension';
import { ExtensionServiceImpl } from '@opensumi/ide-extension/lib/browser/extension.service';
import { MockWorkspaceService } from '@opensumi/ide-workspace/lib/common/mocks';
import { useMockStorage } from '@opensumi/ide-core-browser/__mocks__/storage';
import { MonacoService } from '@opensumi/ide-monaco';
import MonacoServiceImpl from '@opensumi/ide-monaco/lib/browser/monaco.service';
import { MainThreadWebview } from '../../src/browser/vscode/api/main.thread.api.webview';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';
import { StaticResourceService } from '@opensumi/ide-static-resource/lib/browser';
import { StaticResourceServiceImpl } from '@opensumi/ide-static-resource/lib/browser/static.service';
import { AppConfig } from '@opensumi/ide-core-node';
import { MainThreadExtensionDocumentData } from '@opensumi/ide-extension/lib/browser/vscode/api/main.thread.doc';
import {
  IEditorDocumentModelContentRegistry,
  IEditorDocumentModelService,
  EmptyDocCacheImpl,
  EditorDocumentModelCreationEvent,
  EditorComponentRegistry,
  EditorPreferences,
} from '@opensumi/ide-editor/lib/browser';
import {
  EditorDocumentModelContentRegistryImpl,
  EditorDocumentModelServiceImpl,
} from '@opensumi/ide-editor/lib/browser/doc-model/main';
import { FileSchemeDocumentProvider } from '@opensumi/ide-file-scheme/lib/browser/file-doc';
import { MainThreadPreference } from '@opensumi/ide-extension/lib/browser/vscode/api/main.thread.preference';
import {
  PreferenceProviderProvider,
  PreferenceProvider,
  PreferenceService,
  PreferenceServiceImpl,
} from '@opensumi/ide-core-browser';
import { injectMockPreferences } from '@opensumi/ide-core-browser/__mocks__/preference';
import { ResourceServiceImpl } from '@opensumi/ide-editor/lib/browser/resource.service';
import { EditorComponentRegistryImpl } from '@opensumi/ide-editor/lib/browser/component';
import { ExtHostStorage } from '@opensumi/ide-extension/lib/hosted/api/vscode/ext.host.storage';
import { ExtHostTasks } from '@opensumi/ide-extension/lib/hosted/api/vscode/tasks/ext.host.tasks';
import { ExtHostTerminal } from '@opensumi/ide-extension/lib/hosted/api/vscode/ext.host.terminal';
import { mockExtensions } from '../../__mocks__/extensions';
import { DiskFileSystemProvider } from '@opensumi/ide-file-service/lib/node/disk-file-system.provider';
import { MainThreadFileSystem } from '@opensumi/ide-extension/lib/browser/vscode/api/main.thread.file-system';
import { ExtHostFileSystemEvent } from '@opensumi/ide-extension/lib/hosted/api/vscode/ext.host.file-system-event';
import { MockLoggerManagerClient } from '../../__mocks__/loggermanager';
import temp = require('temp');
import { IWebviewService } from '@opensumi/ide-webview';
import vscode from 'vscode';
import { Position, WorkspaceEdit } from '@opensumi/ide-extension/lib/common/vscode/ext-types';
import { IWorkspaceEditService, IWorkspaceFileService } from '@opensumi/ide-workspace-edit';
import { WorkspaceEditServiceImpl } from '@opensumi/ide-workspace-edit/lib/browser/workspace-edit.service';
import { WorkspaceFileService } from '@opensumi/ide-workspace-edit/lib/browser/workspace-file.service';
import { MainThreadFileSystemEvent } from '../../lib/browser/vscode/api/main.thread.file-system-event';

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

function getFileStatType(stat: fs.Stats) {
  if (stat.isDirectory()) {
    return FileType.Directory;
  }
  if (stat.isFile()) {
    return FileType.File;
  }
  if (stat.isSymbolicLink()) {
    return FileType.SymbolicLink;
  }
  return FileType.Unknown;
}

describe('MainThreadWorkspace API Test Suite', () => {
  let extHostWorkspace: ExtHostWorkspace;
  let extHostWorkspaceAPI: ReturnType<typeof createWorkspaceApiFactory>;
  let workspaceService: MockWorkspaceService;
  let extHostDocs: ExtensionDocumentDataManagerImpl;
  let eventBus: IEventBus;
  const disposables = new DisposableCollection();
  const track = temp.track();
  const testEventDir = FileUri.create(fs.realpathSync(temp.mkdirSync('workspace-api-test')));

  const injector = createBrowserInjector(
    [ExtensionStorageModule],
    new MockInjector([
      {
        token: IWorkspaceService,
        useClass: MockWorkspaceService,
      },
      {
        token: IWorkspaceEditService,
        useClass: WorkspaceEditServiceImpl,
      },
      {
        token: IWorkspaceFileService,
        useClass: WorkspaceFileService,
      },
      {
        token: WorkbenchEditorService,
        useClass: WorkbenchEditorServiceImpl,
      },
      {
        token: FileServicePath,
        useClass: FileService,
      },
      {
        token: MonacoService,
        useClass: MonacoServiceImpl,
      },
      {
        token: AppConfig,
        useValue: {},
      },
      {
        token: IEditorDocumentModelContentRegistry,
        useClass: EditorDocumentModelContentRegistryImpl,
      },
      {
        token: ILoggerManagerClient,
        useClass: MockLoggerManagerClient,
      },
      {
        token: IEditorDocumentModelService,
        useClass: EditorDocumentModelServiceImpl,
      },
      {
        token: 'FileServiceOptions',
        useValue: FileSystemNodeOptions.DEFAULT,
      },
      {
        token: IDocPersistentCacheProvider,
        useClass: EmptyDocCacheImpl,
      },
      {
        token: StaticResourceService,
        useClass: StaticResourceServiceImpl,
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
        token: IBrowserFileSystemRegistry,
        useClass: BrowserFileSystemRegistryImpl,
      },
      {
        token: ExtensionService,
        useClass: ExtensionServiceImpl,
      },
      {
        token: FileSchemeDocumentProvider,
        useClass: FileSchemeDocumentProvider,
      },
      {
        token: PreferenceProviderProvider,
        useFactory: () => (scope: PreferenceScope) => injector.get(PreferenceProvider, { tag: scope }),
      },
      {
        token: PreferenceService,
        useClass: PreferenceServiceImpl,
      },
      {
        token: IFileServiceClient,
        useClass: FileServiceClient,
      },
      {
        token: IDiskFileProvider,
        useClass: DiskFileSystemProvider,
      },
      {
        token: EditorPreferences,
        useValue: {},
      },
      {
        token: IWebviewService,
        useValue: mockService({}),
      },
      {
        token: CommonServerPath,
        useValue: {
          getBackendOS: () => Promise.resolve(OS.type()),
        },
      },
      {
        token: IApplicationService,
        useValue: {
          getBackendOS: () => Promise.resolve(OS.type()),
        },
      },
    ]),
  );
  injectMockPreferences(injector);
  useMockStorage(injector);
  beforeAll(async (done) => {
    const root = FileUri.create(fs.realpathSync(temp.mkdirSync('extension-storage-test')));
    const fileServiceClient: FileServiceClient = injector.get(IFileServiceClient);
    fileServiceClient.registerProvider('file', injector.get(IDiskFileProvider));
    injector.mock(ILoggerManagerClient, 'getLogFolder', () => root.path.toString());
    const extHostMessage = rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostMessage, new ExtHostMessage(rpcProtocolExt));
    extHostDocs = rpcProtocolExt.set(
      ExtHostAPIIdentifier.ExtHostDocuments,
      injector.get(ExtensionDocumentDataManagerImpl, [rpcProtocolExt]),
    );
    const extWorkspace = new ExtHostWorkspace(rpcProtocolExt, extHostMessage, extHostDocs);
    const extHostTerminal = new ExtHostTerminal(rpcProtocolExt);
    const extHostTask = new ExtHostTasks(rpcProtocolExt, extHostTerminal, extWorkspace);
    extHostWorkspace = rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostWorkspace, extWorkspace);
    const monacoservice = injector.get(MonacoService);
    await monacoservice.loadMonaco();
    const mainThreadWorkspaceAPI = injector.get(MainThreadWorkspace, [rpcProtocolMain]);
    rpcProtocolMain.set(MainThreadAPIIdentifier.MainThreadWorkspace, mainThreadWorkspaceAPI);
    rpcProtocolMain.set(MainThreadAPIIdentifier.MainThreadWebview, injector.get(MainThreadWebview, [rpcProtocolMain]));
    rpcProtocolMain.set(
      MainThreadAPIIdentifier.MainThreadDocuments,
      injector.get(MainThreadExtensionDocumentData, [rpcProtocolMain]),
    );
    const extHostFileSystemInfo = rpcProtocolExt.set(
      ExtHostAPIIdentifier.ExtHostFileSystemInfo,
      new ExtHostFileSystemInfo(),
    );
    rpcProtocolMain.set(
      MainThreadAPIIdentifier.MainThreadFileSystem,
      injector.get(MainThreadFileSystem, [rpcProtocolMain]),
    );
    injector.get(MainThreadFileSystemEvent, [rpcProtocolMain]);
    const extHostFileSystem = rpcProtocolExt.set(
      ExtHostAPIIdentifier.ExtHostFileSystem,
      new ExtHostFileSystem(rpcProtocolExt, extHostFileSystemInfo),
    );
    const extHostFileSystemEvent = rpcProtocolExt.set(
      ExtHostAPIIdentifier.ExtHostFileSystemEvent,
      new ExtHostFileSystemEvent(rpcProtocolExt, extHostDocs),
    );
    const extHostPreference = rpcProtocolExt.set(
      ExtHostAPIIdentifier.ExtHostPreference,
      new ExtHostPreference(rpcProtocolExt, extHostWorkspace),
    ) as ExtHostPreference;
    rpcProtocolMain.set(
      MainThreadAPIIdentifier.MainThreadPreference,
      injector.get(MainThreadPreference, [rpcProtocolMain]),
    );
    extHostWorkspaceAPI = createWorkspaceApiFactory(
      extHostWorkspace,
      extHostPreference,
      extHostDocs,
      extHostFileSystem,
      extHostFileSystemEvent,
      extHostTask,
      mockExtensions[0],
    );
    rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostStorage, new ExtHostStorage(rpcProtocolExt));
    const modelContentRegistry: IEditorDocumentModelContentRegistry = injector.get(IEditorDocumentModelContentRegistry);
    modelContentRegistry.registerEditorDocumentModelContentProvider(injector.get(FileSchemeDocumentProvider));
    workspaceService = injector.get(IWorkspaceService);
    eventBus = injector.get(IEventBus);
    await (injector.get(IEditorDocumentModelService) as EditorDocumentModelServiceImpl).initialize();
    done();
  });
  afterAll(() => {
    track.cleanupSync();
    disposables.dispose();
    injector.disposeAll();
  });

  describe('MainThreadWorkspace fs API Test Suite', () => {
    it('should have enough fs API', async () => {
      const { fs: extFs } = extHostWorkspaceAPI;
      expect(typeof extFs.stat).toBe('function');
      expect(typeof extFs.copy).toBe('function');
      expect(typeof extFs.createDirectory).toBe('function');
      expect(typeof extFs.delete).toBe('function');
      expect(typeof extFs.readDirectory).toBe('function');
      expect(typeof extFs.readFile).toBe('function');
      expect(typeof extFs.rename).toBe('function');
      expect(typeof extFs.writeFile).toBe('function');
    });

    it('should able to readfile', async () => {
      const filePath = path.join(__dirname, 'main.thread.output.test.ts');
      const content = await extHostWorkspaceAPI.fs.readFile(vscodeUri.file(filePath));
      expect(content.toString()).toBe(fs.readFileSync(filePath, { encoding: 'utf8' }).toString());
    });

    it('should able to readDir', async () => {
      const result = await extHostWorkspaceAPI.fs.readDirectory(Uri.file(path.resolve(__dirname)));
      const fsResult = fs.readdirSync(path.resolve(__dirname));
      expect(result).toEqual(fsResult.map((v: string) => [v, getFileStatType(fs.statSync(path.join(__dirname, v)))]));
    });

    it('should able to get filestat', async (done) => {
      const filestat = await extHostWorkspaceAPI.fs.stat(
        vscodeUri.file(path.join(__dirname, 'main.thread.output.test.ts')),
      );
      const nativeFileStat = fs.statSync(path.join(__dirname, 'main.thread.output.test.ts'));
      expect(nativeFileStat.size).toBe(filestat.size);
      expect(filestat.type).toBe(1);
      done();
    });

    it('should able to writefile', async (done) => {
      const filepath = path.join(os.tmpdir(), Math.floor(Math.random() * 1000) + '', 'hello.ts');
      const encoder = new util.TextEncoder();
      await extHostWorkspaceAPI.fs.writeFile(
        vscodeUri.file(filepath),
        new Uint8Array(encoder.encode('hello opensumi')),
      );
      expect(fs.existsSync(filepath)).toBeTruthy();
      expect(fs.readFileSync(filepath).toString()).toBe('hello opensumi');
      done();
    });
  });

  it('should be able to updateWorkspaceFolders', async (done) => {
    const rawUri = vscodeUri.file(path.join(__dirname));
    extHostWorkspaceAPI.updateWorkspaceFolders(0, 0, { uri: rawUri });
    setTimeout(() => {
      const root = workspaceService.tryGetRoots();
      expect(root.length).toBe(1);
      expect(root[0].uri).toBe(rawUri.toString());
      done();
    });
  });

  it('should be able to openTextDocument', async (done) => {
    const filePath = path.join(__dirname, 'main.thread.output.test.ts');
    const disposeable = eventBus.on(EditorDocumentModelCreationEvent, (e) => {
      expect(e.payload.content).toBe(fs.readFileSync(filePath).toString());
      expect(e.payload.uri.toString()).toBe(vscodeUri.file(filePath).toString());
      disposeable.dispose();
      done();
    });
    extHostWorkspaceAPI.openTextDocument(vscodeUri.file(filePath));
  });

  it('should be able to getConfiguration and use default value', async (done) => {
    const config = extHostWorkspaceAPI.getConfiguration('a.b', '', '');
    expect(config.get('mockobj.key', 'defaultvalue')).toBe('defaultvalue');

    done();
  });

  it('should be able to registerTextDocumentContentProvider', async (done) => {
    const emitter = new Emitter<any>();
    const testcase = 'testcontent';
    const testuri = vscodeUri.file('/path/to/content').with({ scheme: 'test1' });
    const disposeable = extHostWorkspaceAPI.registerTextDocumentContentProvider('test1', {
      onDidChange: emitter.event,
      provideTextDocumentContent: () => testcase,
    });
    const content = await extHostDocs.openTextDocument(testuri);
    expect(content.getText()).toBe(testcase);
    expect(content.uri.toString()).toBe(testuri.toString());
    disposeable.dispose();
    done();
  });

  it('should receive onDidOpenTextDocument event when called openTextDocument', async (done) => {
    const filePath = path.join(__dirname, 'activation.service.test.ts'); // use other
    const disposable = extHostWorkspaceAPI.onDidOpenTextDocument((e) => {
      expect(e.uri.path).toBe(filePath);
      expect(e.getText()).toBe(fs.readFileSync(filePath).toString());
      done();
      disposable.dispose();
    });
    extHostWorkspaceAPI.openTextDocument(vscodeUri.file(filePath));
  });

  it('should reveive onWillCreateFiles/onDidCreateFiles event', async (done) => {
    const newUri = testEventDir.withPath(testEventDir.path.join('./test-create')).codeUri;
    let onWillCreate: vscode.FileWillCreateEvent | undefined;
    let onDidCreate: vscode.FileCreateEvent | undefined;
    disposables.push(extHostWorkspaceAPI.onWillCreateFiles((e) => (onWillCreate = e)));
    disposables.push(extHostWorkspaceAPI.onDidCreateFiles((e) => (onDidCreate = e)));

    const edit = new WorkspaceEdit();
    edit.createFile(newUri);

    const success = await extHostWorkspaceAPI.applyEdit(edit);
    expect(success).toBeTruthy();

    expect(onWillCreate?.files.length).toEqual(1);
    expect(onWillCreate?.files[0].toString()).toEqual(newUri.toString());

    expect(onDidCreate?.files.length).toEqual(1);
    expect(onDidCreate?.files[0].toString()).toEqual(newUri.toString());
    done();
  });

  it.skip('should be able to make changes before file create', async (done) => {
    const randomFile = path.join(testEventDir.codeUri.fsPath, Math.random().toString(18).slice(2, 5));
    fs.writeFileSync(randomFile, '');
    const doc = await extHostWorkspaceAPI.openTextDocument(randomFile);

    const newUri = testEventDir.withPath(testEventDir.path.join('./test-create2')).codeUri;

    disposables.push(
      extHostWorkspaceAPI.onWillCreateFiles((e) => {
        const edit = new WorkspaceEdit();
        edit.insert(Uri.file(randomFile), new Position(0, 0), 'HELLO');
        e.waitUntil(Promise.resolve(edit));
      }),
    );

    const edit2 = new WorkspaceEdit();
    edit2.createFile(newUri);

    const success = await extHostWorkspaceAPI.applyEdit(edit2);
    expect(success).toBeTruthy();

    expect(doc?.getText()).toEqual('HELLO');
    done();
  });

  it('should reveive onWillDeleteFiles/onDidDeleteFiles event', async (done) => {
    const newUri = testEventDir.withPath(testEventDir.path.join('./test-create3')).codeUri;
    fs.writeFileSync(newUri.fsPath, '');
    let onWillCreate: vscode.FileWillDeleteEvent | undefined;
    let onDidCreate: vscode.FileDeleteEvent | undefined;
    disposables.push(extHostWorkspaceAPI.onWillDeleteFiles((e) => (onWillCreate = e)));
    disposables.push(extHostWorkspaceAPI.onDidDeleteFiles((e) => (onDidCreate = e)));

    const edit = new WorkspaceEdit();
    edit.deleteFile(newUri);

    const success = await extHostWorkspaceAPI.applyEdit(edit);
    expect(success).toBeTruthy();

    expect(onWillCreate?.files.length).toEqual(1);
    expect(onWillCreate?.files[0].toString()).toEqual(newUri.toString());

    expect(onDidCreate?.files.length).toEqual(1);
    expect(onDidCreate?.files[0].toString()).toEqual(newUri.toString());
    done();
  });

  it('should be able to make changes before file delete', async (done) => {
    const randomFile = path.join(testEventDir.codeUri.fsPath, Math.random().toString(18).slice(2, 5));
    const randomFile2 = path.join(testEventDir.codeUri.fsPath, Math.random().toString(18).slice(2, 5));
    fs.writeFileSync(randomFile, '');
    fs.writeFileSync(randomFile2, '');

    disposables.push(
      extHostWorkspaceAPI.onWillCreateFiles((e) => {
        if (e.files[0].toString() === randomFile) {
          const edit = new WorkspaceEdit();
          edit.deleteFile(Uri.file(randomFile2));
          e.waitUntil(Promise.resolve(edit));
        }
      }),
    );

    const edit2 = new WorkspaceEdit();
    edit2.deleteFile(Uri.file(randomFile));

    const success = await extHostWorkspaceAPI.applyEdit(edit2);
    expect(success).toBeTruthy();
    done();
  });

  it('should reveive onWillRenameFiles/onDidRenameFiles event', async (done) => {
    const oldUri = Uri.file(path.join(testEventDir.codeUri.fsPath, Math.random().toString(18).slice(2, 5)));
    const newUri = Uri.file(path.join(testEventDir.codeUri.fsPath, Math.random().toString(18).slice(2, 5)));
    fs.writeFileSync(oldUri.fsPath, '');

    let onWillRename: vscode.FileWillRenameEvent | undefined;
    let onDidRename: vscode.FileRenameEvent | undefined;

    disposables.push(extHostWorkspaceAPI.onWillRenameFiles((e) => (onWillRename = e)));
    disposables.push(extHostWorkspaceAPI.onDidRenameFiles((e) => (onDidRename = e)));

    const edit = new WorkspaceEdit();
    edit.renameFile(oldUri, newUri);

    const success = await extHostWorkspaceAPI.applyEdit(edit);
    expect(success).toBeTruthy();

    expect(onWillRename).toBeDefined();
    expect(onWillRename?.files.length).toEqual(1);
    expect(onWillRename?.files[0].oldUri.toString()).toEqual(oldUri.toString());
    expect(onWillRename?.files[0].newUri.toString()).toEqual(newUri.toString());

    expect(onDidRename).toBeDefined();
    expect(onDidRename?.files.length).toEqual(1);
    expect(onDidRename?.files[0].oldUri.toString()).toEqual(oldUri.toString());
    expect(onDidRename?.files[0].newUri.toString()).toEqual(newUri.toString());
    done();
  });

  it('should receive onDidChangeWorkspaceFolders when workspace folder has changed', async (done) => {
    extHostWorkspaceAPI.onDidChangeWorkspaceFolders((e) => {
      expect(e.added.length).toBe(1);
      expect(e.added[0].name).toBe(path.basename(__dirname));
      done();
    });
    const fileServiceClient: FileServiceClient = injector.get(IFileServiceClient);
    const roots = [await fileServiceClient.getFileStat(URI.file(path.join(__dirname)).toString())];
    workspaceService._onWorkspaceChanged.fire(roots as FileStat[]);
  });
});

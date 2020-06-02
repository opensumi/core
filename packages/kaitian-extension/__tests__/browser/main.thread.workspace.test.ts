import { Emitter, IFileServiceClient, URI, Uri, IEventBus, PreferenceScope } from '@ali/ide-core-common';
import { Injector } from '@ali/common-di';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as util from 'util';
import vscodeUri from 'vscode-uri';
import { RPCProtocol } from '@ali/ide-connection/lib/common/rpcProtocol';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MainThreadWorkspace } from '@ali/ide-kaitian-extension/lib/browser/vscode/api/main.thread.workspace';
import { ExtHostWorkspace, createWorkspaceApiFactory } from '../../src/hosted/api/vscode/ext.host.workspace';
import { ExtHostAPIIdentifier, MainThreadAPIIdentifier } from '@ali/ide-kaitian-extension/lib/common/vscode';
import { ExtHostMessage } from '@ali/ide-kaitian-extension/lib/hosted/api/vscode/ext.host.message';
import { ExtensionDocumentDataManagerImpl } from '@ali/ide-kaitian-extension/lib/hosted/api/vscode/doc';
import { ExtHostPreference } from '@ali/ide-kaitian-extension/lib/hosted/api/vscode/ext.host.preference';
import { ExtHostFileSystem } from '@ali/ide-kaitian-extension/lib/hosted/api/vscode/ext.host.file-system';
import { IWorkspaceService } from '@ali/ide-workspace';
import { IDocPersistentCacheProvider, ResourceService } from '@ali/ide-editor/lib/common';
import { DiskFileSystemProviderWithoutWatcherForExtHost } from '@ali/ide-file-service/lib/node/disk-file-system.provider';
import { FileServiceClient, BrowserFileSystemRegistryImpl } from '@ali/ide-file-service/lib/browser/file-service-client';
import { FileServicePath, FileStat, FileType, IBrowserFileSystemRegistry } from '@ali/ide-file-service';
import { FileService, FileSystemNodeOptions } from '@ali/ide-file-service/lib/node';
import { ExtensionStorageServerPath } from '@ali/ide-extension-storage';
import { ExtensionStorageModule } from '@ali/ide-extension-storage/lib/browser';
import { ExtensionService } from '@ali/ide-kaitian-extension';
import { ExtensionServiceImpl } from '@ali/ide-kaitian-extension/lib/browser/extension.service';
import { MockWorkspaceService } from '@ali/ide-workspace/lib/common/mocks';
import { useMockStorage } from '@ali/ide-core-browser/lib/mocks/storage';
import { MonacoService } from '@ali/ide-monaco';
import MonacoServiceImpl from '@ali/ide-monaco/lib/browser/monaco.service';
import { MainThreadWebview } from '../../src/browser/vscode/api/main.thread.api.webview';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { WorkbenchEditorServiceImpl } from '@ali/ide-editor/lib/browser/workbench-editor.service';
import { StaticResourceService } from '@ali/ide-static-resource/lib/browser';
import { StaticResourceServiceImpl } from '@ali/ide-static-resource/lib/browser/static.service';
import { AppConfig } from '@ali/ide-core-node';
import { MainThreadExtensionDocumentData } from '@ali/ide-kaitian-extension/lib/browser/vscode/api/main.thread.doc';
import { IEditorDocumentModelContentRegistry, IEditorDocumentModelService, EmptyDocCacheImpl, EditorDocumentModelCreationEvent, EditorComponentRegistry, EditorPreferences } from '@ali/ide-editor/lib/browser';
import { EditorDocumentModelContentRegistryImpl, EditorDocumentModelServiceImpl } from '@ali/ide-editor/lib/browser/doc-model/main';
import { FileSchemeDocumentProvider } from '@ali/ide-file-scheme/lib/browser/file-doc';
import { MainThreadPreference } from '@ali/ide-kaitian-extension/lib/browser/vscode/api/main.thread.preference';
import { PreferenceProviderProvider, PreferenceProvider, PreferenceService, PreferenceServiceImpl } from '@ali/ide-core-browser';
import { injectMockPreferences } from '@ali/ide-core-browser/lib/mocks/preference';
import { ResourceServiceImpl } from '@ali/ide-editor/lib/browser/resource.service';
import { EditorComponentRegistryImpl } from '@ali/ide-editor/lib/browser/component';
import { ExtHostStorage } from '@ali/ide-kaitian-extension/lib/hosted/api/vscode/ext.host.storage';
import { ExtHostTasks } from '@ali/ide-kaitian-extension/lib/hosted/api/vscode/tasks/ext.host.tasks';
import { ExtHostTerminal } from '@ali/ide-kaitian-extension/lib/hosted/api/vscode/ext.host.terminal';
import { mockExtensions } from '../__mock__/extensions';

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

  const injector = createBrowserInjector([ExtensionStorageModule], new Injector([
    {
      token: IWorkspaceService,
      useClass: MockWorkspaceService,
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
      useFactory: () => {
        return (scope: PreferenceScope) => {
          return injector.get(PreferenceProvider, { tag: scope });
        };
      },
    }, {
      token: PreferenceService,
      useClass: PreferenceServiceImpl,
    },
    {
      token: ExtensionStorageServerPath,
      useValue: {
        getAll() {

        },
        init() {
          return Promise.resolve();
        },
      } ,
    },
    {
      token: IFileServiceClient,
      useClass: FileServiceClient,
    },
    {
      token: EditorPreferences,
      useValue: {},
    },
  ]));
  injectMockPreferences(injector);
  useMockStorage(injector);
  beforeAll(async (done) => {
    const extHostMessage = rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostMessage, new ExtHostMessage(rpcProtocolExt));
    extHostDocs = rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostDocuments, injector.get(ExtensionDocumentDataManagerImpl, [rpcProtocolExt]));
    const extWorkspace = new ExtHostWorkspace(rpcProtocolExt, extHostMessage, extHostDocs);
    const extHostTerminal = new ExtHostTerminal(rpcProtocolExt);
    const extHostTask = new ExtHostTasks(rpcProtocolExt, extHostTerminal, extWorkspace);
    extHostWorkspace = rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostWorkspace, extWorkspace);
    const monacoservice = injector.get(MonacoService);
    await monacoservice.loadMonaco();
    const mainThreadWorkspaceAPI = injector.get(MainThreadWorkspace, [rpcProtocolMain]);
    rpcProtocolMain.set(MainThreadAPIIdentifier.MainThreadWorkspace, mainThreadWorkspaceAPI);
    rpcProtocolMain.set(MainThreadAPIIdentifier.MainThreadWebview, injector.get(MainThreadWebview, [rpcProtocolMain]));
    rpcProtocolMain.set(MainThreadAPIIdentifier.MainThreadDocuments, injector.get(MainThreadExtensionDocumentData, [rpcProtocolMain]));
    const extHostFileSystem = rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostFileSystem, new ExtHostFileSystem(rpcProtocolExt));
    const extHostPreference = rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostPreference, new ExtHostPreference(rpcProtocolExt, extHostWorkspace)) as ExtHostPreference;
    rpcProtocolMain.set(MainThreadAPIIdentifier.MainThreadPreference, injector.get(MainThreadPreference, [rpcProtocolMain]));
    extHostWorkspaceAPI = createWorkspaceApiFactory(extHostWorkspace, extHostPreference, extHostDocs, extHostFileSystem, extHostTask, mockExtensions[0]);
    rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostStorage, new ExtHostStorage(rpcProtocolExt));
    const modelContentRegistry: IEditorDocumentModelContentRegistry = injector.get(IEditorDocumentModelContentRegistry);
    modelContentRegistry.registerEditorDocumentModelContentProvider(injector.get(FileSchemeDocumentProvider));
    workspaceService = injector.get(IWorkspaceService);
    eventBus = injector.get(IEventBus);
    done();
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
      expect(extFs.innerFs instanceof DiskFileSystemProviderWithoutWatcherForExtHost).toBe(true);
    });

    it('should able to readfile', async () => {
      const filePath = path.join(__dirname, 'main.thread.output.test.ts');
      const content = await (await extHostWorkspaceAPI.fs.readFile(vscodeUri.file(filePath))).toString();
      expect(content).toBe(fs.readFileSync(filePath, { encoding: 'utf8' }).toString());
    });

    it('should able to readDir', async () => {
      const result = await extHostWorkspaceAPI.fs.readDirectory(Uri.parse(path.resolve(__dirname)));
      const fsResult = fs.readdirSync(path.resolve(__dirname));
      expect(result).toEqual(fsResult.map((v: string) => [v, getFileStatType(fs.statSync(path.join(__dirname, v)))]));
    });

    it('should able to get filestat', async (done) => {
      const filestat = await extHostWorkspaceAPI.fs.stat(vscodeUri.file(path.join(__dirname, 'main.thread.output.test.ts')));
      const nativeFileStat = fs.statSync(path.join(__dirname, 'main.thread.output.test.ts'));
      expect(nativeFileStat.size).toBe(filestat.size);
      expect(filestat.type).toBe(1);
      done();
    });

    it('should able to writefile', async (done) => {
      const filepath = path.join(os.tmpdir(), 'hello.ts');
      const encoder = new util.TextEncoder();
      await extHostWorkspaceAPI.fs.writeFile(vscodeUri.file(filepath), new Uint8Array(encoder.encode('hello kaitian')));
      expect(fs.existsSync(filepath)).toBeTruthy();
      expect(fs.readFileSync(filepath).toString()).toBe('hello kaitian');
      done();
    });

    // TODO more test case
  });

  it('should able to updateWorkspaceFolders', async (done) => {
    const rawUri = vscodeUri.parse(path.join(__dirname));
    extHostWorkspaceAPI.updateWorkspaceFolders(0, 0, { uri: rawUri });
    setTimeout(() => {
      const root = workspaceService.tryGetRoots();
      expect(root.length).toBe(1);
      expect(root[0].uri).toBe(rawUri.toString());
      done();
    });
  });

  it('should able to openTextDocument', async (done) => {
    const filePath = path.join(__dirname, 'main.thread.output.test.ts');
    const disposeable = eventBus.on(EditorDocumentModelCreationEvent, (e) => {
      expect(e.payload.content).toBe(fs.readFileSync(filePath).toString());
      expect(e.payload.uri.toString()).toBe(vscodeUri.file(filePath).toString());
      disposeable.dispose();
      done();
    });
    extHostWorkspaceAPI.openTextDocument(vscodeUri.file(filePath));
  });

  it('should able to getConfiguration and use default value', async (done) => {
    const config = extHostWorkspaceAPI.getConfiguration('a.b', '', '');
    expect(config.get('mockobj.key', 'defaultvalue')).toBe('defaultvalue');

    done();
  });

  it('should able to registerTextDocumentContentProvider', async (done) => {
    const emitter = new Emitter<any>();
    const testcase = 'testcontent';
    const testuri = vscodeUri.parse('test1://path/to/content');
    const disposeable = extHostWorkspaceAPI.registerTextDocumentContentProvider('test1', {
      onDidChange: emitter.event,
      provideTextDocumentContent: (uri, token) => {
        return testcase;
      },
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

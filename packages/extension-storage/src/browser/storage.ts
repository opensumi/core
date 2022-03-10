import { Injectable, Autowired } from '@opensumi/di';
import { Deferred, URI, ILogger, StoragePaths, ThrottledDelayer, Throttler, Uri } from '@opensumi/ide-core-common';
import { Path } from '@opensumi/ide-core-common/lib/path';
import { IFileServiceClient, FileStat } from '@opensumi/ide-file-service';

import {
  ExtensionStorageUri,
  IExtensionStoragePathServer,
  IExtensionStorageServer,
  KeysToAnyValues,
  KeysToKeysToAnyValue,
  DEFAULT_EXTENSION_STORAGE_DIR_NAME,
  IExtensionStorageTask,
} from '../common/';

@Injectable()
export class ExtensionStorageServer implements IExtensionStorageServer {
  private static readonly DEFAULT_FLUSH_DELAY = 100;

  private workspaceDataDirPath: string | undefined;
  private globalDataPath: string | undefined;

  private deferredWorkspaceDataDirPath = new Deferred<string>();
  private storageDelayer: ThrottledDelayer<void>;
  private storageThrottler: Throttler = new Throttler();
  private storageTasks: IExtensionStorageTask = {};

  @Autowired(IExtensionStoragePathServer)
  private readonly extensionStoragePathsServer: IExtensionStoragePathServer;

  @Autowired(IFileServiceClient)
  protected readonly fileSystem: IFileServiceClient;

  @Autowired(ILogger)
  protected readonly logger: ILogger;

  private storageExistPromises: Map<string, Promise<boolean>> = new Map();

  public async init(
    workspace: FileStat | undefined,
    roots: FileStat[],
    extensionStorageDirName?: string,
  ): Promise<ExtensionStorageUri> {
    this.storageDelayer = new ThrottledDelayer(ExtensionStorageServer.DEFAULT_FLUSH_DELAY);
    return await this.setupDirectories(workspace, roots, extensionStorageDirName || DEFAULT_EXTENSION_STORAGE_DIR_NAME);
  }

  private async asAccess(storageUri: string, force?: boolean) {
    if (force) {
      return await this.fileSystem.access(storageUri);
    }
    if (!this.storageExistPromises.has(storageUri)) {
      const promise = this.fileSystem.access(storageUri);
      this.storageExistPromises.set(storageUri, promise);
    }
    return await this.storageExistPromises.get(storageUri);
  }

  private async setupDirectories(workspace, roots, extensionStorageDirName): Promise<ExtensionStorageUri> {
    const workspaceDataDirPath = await this.extensionStoragePathsServer.getWorkspaceDataDirPath(
      extensionStorageDirName,
    );
    const wsDataFsPath = URI.file(workspaceDataDirPath).toString();
    if (!(await this.fileSystem.access(wsDataFsPath))) {
      await this.fileSystem.createFolder(wsDataFsPath);
    }
    this.workspaceDataDirPath = workspaceDataDirPath;

    this.globalDataPath = new Path(this.workspaceDataDirPath)
      .join(StoragePaths.EXTENSIONS_GLOBAL_STORAGE_DIR)
      .toString();
    const globalFsPath = URI.file(this.globalDataPath).toString();
    if (!(await this.fileSystem.access(globalFsPath))) {
      await this.fileSystem.createFolder(globalFsPath);
    }

    this.deferredWorkspaceDataDirPath.resolve(this.workspaceDataDirPath);

    const logUri = await this.extensionStoragePathsServer.provideHostLogPath();
    const storageUri = await this.extensionStoragePathsServer.provideHostStoragePath(
      workspace,
      roots,
      extensionStorageDirName,
    );

    // 返回插件storage存储路径信息
    return {
      logUri: logUri.codeUri || undefined,
      storageUri: storageUri?.codeUri,
      globalStorageUri: Uri.parse(this.globalDataPath),
    };
  }

  private async resolveStorageTask(tasks: any) {
    const storagePaths = Object.keys(tasks);
    for (const path of storagePaths) {
      const data = await this.readFromFile(path);
      for (const { key, value } of tasks[path]) {
        if (value === undefined || value === {}) {
          delete data[key];
        } else {
          data[key] = value;
        }
      }
      await this.writeToFile(path, data);
    }
  }

  private doSet() {
    const tasks = { ...this.storageTasks };
    this.storageTasks = {};
    return this.resolveStorageTask(tasks);
  }

  async set(key: string, value: KeysToAnyValues, isGlobal: boolean): Promise<void> {
    const path = await this.getDataPath(isGlobal);
    if (!path) {
      throw new Error('Cannot save data: no opened workspace');
    }
    if (!this.storageTasks[path]) {
      this.storageTasks[path] = [];
    }
    this.storageTasks[path].push({ key, value });
    // 延迟100ms后再队列写入
    return this.storageDelayer.trigger(() => this.storageThrottler.queue<void>(this.doSet.bind(this)));
  }

  async get(key: string, isGlobal: boolean): Promise<KeysToAnyValues> {
    const dataPath = await this.getDataPath(isGlobal);
    if (!dataPath) {
      return {};
    }
    const data = await this.readFromFile(dataPath);
    return data[key];
  }

  async getAll(isGlobal: boolean): Promise<KeysToKeysToAnyValue> {
    const dataPath = await this.getDataPath(isGlobal);
    if (!dataPath) {
      return {};
    }

    const data = await this.readFromFile(dataPath);
    return data;
  }

  private async getDataPath(isGlobal: boolean): Promise<string | undefined> {
    if (this.workspaceDataDirPath === undefined) {
      // 等待工作区的存储路径返回
      await this.deferredWorkspaceDataDirPath.promise;
    }

    if (isGlobal) {
      return new Path(this.globalDataPath!).join('global-state.json').toString();
    } else {
      const storagePath = await this.extensionStoragePathsServer.getLastWorkspaceStoragePath();
      return storagePath ? new Path(storagePath).join('workspace-state.json').toString() : undefined;
    }
  }

  private async readFromFile(pathToFile: string): Promise<KeysToKeysToAnyValue> {
    const target = URI.file(pathToFile);
    const existed = await this.asAccess(target.toString(), true);
    if (!existed) {
      return {};
    }
    try {
      const { content } = await this.fileSystem.readFile(target.toString());
      return JSON.parse(content.toString());
    } catch (error) {
      this.logger.error('Failed to parse data from "', target.toString(), '". Reason:', error);
      return {};
    }
  }

  private async writeToFile(pathToFile: string, data: KeysToKeysToAnyValue): Promise<void> {
    const target = URI.file(pathToFile);
    const existed = await this.asAccess(target.parent.toString());
    if (!existed) {
      await this.fileSystem.createFolder(target.parent.toString());
    }
    const rawData = JSON.stringify(data);
    let fileStat = await this.fileSystem.getFileStat(target.toString());
    if (!fileStat) {
      fileStat = await this.fileSystem.createFile(target.toString());
    }
    await this.fileSystem.setContent(fileStat, rawData);
  }
}

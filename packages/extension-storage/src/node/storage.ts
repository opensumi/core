import * as fs from 'fs';
import * as path from 'path';
import { Injectable, Autowired } from '@ali/common-di';
import { Deferred, URI, ExtensionPaths, INodeLogger } from '@ali/ide-core-node';
import { IFileService, FileStat } from '@ali/ide-file-service';
import { ExtensionStoragePath, IExtensionStoragePathServer, IExtensionStorageServer, KeysToAnyValues, KeysToKeysToAnyValue } from '../common/';

@Injectable()
export class ExtensionStorageServer implements IExtensionStorageServer {
  private workspaceDataDirPath: string | undefined;
  private globalDataPath: string | undefined;

  private deferredWorkspaceDataDirPath = new Deferred<string>();

  @Autowired(IExtensionStoragePathServer)
  private readonly extensionStoragePathsServer: IExtensionStoragePathServer;

  @Autowired(IFileService)
  protected readonly fileSystem: IFileService;

  @Autowired(INodeLogger)
  protected readonly logger: INodeLogger;

  public async init(workspace: FileStat | undefined, roots: FileStat[]): Promise<ExtensionStoragePath> {
    return await this.setupDirectories(workspace, roots);
  }

  private async setupDirectories(workspace, roots): Promise<ExtensionStoragePath> {
    const workspaceDataDirPath = await this.extensionStoragePathsServer.getWorkspaceDataDirPath();
    await this.fileSystem.createFolder(URI.file(workspaceDataDirPath).toString());
    this.workspaceDataDirPath = workspaceDataDirPath;

    this.globalDataPath = path.join(this.workspaceDataDirPath, ExtensionPaths.EXTENSIONS_GLOBAL_STORAGE_DIR, 'global-state.json');
    await this.fileSystem.createFolder(URI.file(path.dirname(this.globalDataPath)).toString());

    this.deferredWorkspaceDataDirPath.resolve(this.workspaceDataDirPath);

    const logPath = await this.extensionStoragePathsServer.provideHostLogPath();
    const storagePath = await this.extensionStoragePathsServer.provideHostStoragePath(workspace, roots);
    const globalStoragePath = this.globalDataPath;
    // 返回插件storage存储路径信息
    return {
      logPath,
      storagePath,
      globalStoragePath,
    };
  }

  async set(key: string, value: KeysToAnyValues, isGlobal: boolean): Promise<boolean> {
    const dataPath = await this.getDataPath(isGlobal);
    if (!dataPath) {
      throw new Error('Cannot save data: no opened workspace');
    }

    const data = await this.readFromFile(dataPath);

    if (value === undefined || value === {}) {
      delete data[key];
    } else {
      data[key] = value;
    }

    await this.writeToFile(dataPath, data);
    return true;
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
      return this.globalDataPath!;
    } else {
      const storagePath = await this.extensionStoragePathsServer.getLastStoragePath();
      return storagePath ? path.join(storagePath, 'workspace-state.json') : undefined;
    }
  }

  private async readFromFile(pathToFile: string): Promise<KeysToKeysToAnyValue> {
    const existed = await this.fileSystem.exists(pathToFile);
    if (!existed) {
      return {};
    }
    try {
      const { content } = await this.fileSystem.resolveContent(pathToFile);
      return JSON.parse(content);
    } catch (error) {
      this.logger.error('Failed to parse data from "', pathToFile, '". Reason:', error);
      return {};
    }
  }

  private async writeToFile(pathToFile: string, data: KeysToKeysToAnyValue): Promise<void> {
    const existed = await this.fileSystem.exists(path.dirname(pathToFile));
    if (!existed) {
      await this.fileSystem.createFolder(path.dirname(pathToFile));
    }
    const rawData = JSON.stringify(data);

    await this.fileSystem.setContent({
      uri: pathToFile,
      lastModification: new Date().getTime(),
      isDirectory: false,
    } as FileStat, rawData);
  }
}

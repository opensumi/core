import * as fs from 'fs';
import * as path from 'path';
import { Injectable, Autowired } from '@ali/common-di';
import { Deferred } from '@ali/ide-core-node';
import { IFileService } from '@ali/ide-file-service';
import { IExtensionStoragePathServer, IExtensionStorageServer, KeysToAnyValues, KeysToKeysToAnyValue, ExtensionPaths } from '../common/';

@Injectable()
export class ExtensionStorageServer implements IExtensionStorageServer {
  private workspaceDataDirPath: string | undefined;
  private globalDataPath: string | undefined;

  private deferredWorkspaceDataDirPath = new Deferred<string>();

  @Autowired(IExtensionStoragePathServer)
  private readonly extensionStoragePathsService: IExtensionStoragePathServer;

  @Autowired(IFileService)
  protected readonly fileSystem: IFileService;

  constructor() {
    this.setupDirectories();
  }

  private async setupDirectories() {
    const workspaceDataDirPath = await this.extensionStoragePathsService.getWorkspaceDataDirPath();
    await this.fileSystem.createFolder(workspaceDataDirPath);
    this.workspaceDataDirPath = workspaceDataDirPath;

    this.globalDataPath = path.join(this.workspaceDataDirPath, ExtensionPaths.EXTENSIONS_GLOBAL_STORAGE_DIR, 'global-state.json');
    await this.fileSystem.createFolder(path.dirname(this.globalDataPath));

    this.deferredWorkspaceDataDirPath.resolve(this.workspaceDataDirPath);
  }

  async set(key: string, value: KeysToAnyValues, isGlobal: boolean): Promise<boolean> {
    const dataPath = await this.getDataPath(isGlobal);
    if (!dataPath) {
      throw new Error('Cannot save data: no opened workspace');
    }

    const data = this.readFromFile(dataPath);

    if (value === undefined || value === {}) {
      delete data[key];
    } else {
      data[key] = value;
    }

    this.writeToFile(dataPath, data);
    return true;
  }

  async get(key: string, isGlobal: boolean): Promise<KeysToAnyValues> {
    const dataPath = await this.getDataPath(isGlobal);
    if (!dataPath) {
      return {};
    }

    const data = this.readFromFile(dataPath);
    return data[key];
  }

  async getAll(isGlobal: boolean): Promise<KeysToKeysToAnyValue> {
    const dataPath = await this.getDataPath(isGlobal);
    if (!dataPath) {
      return {};
    }

    const data = this.readFromFile(dataPath);
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
      const storagePath = await this.extensionStoragePathsService.getLastStoragePath();
      return storagePath ? path.join(storagePath, 'workspace-state.json') : undefined;
    }
  }

  private readFromFile(pathToFile: string): KeysToKeysToAnyValue {
    if (!fs.existsSync(pathToFile)) {
      return {};
    }

    const rawData = fs.readFileSync(pathToFile, 'utf8');
    try {
      return JSON.parse(rawData);
    } catch (error) {
      console.error('Failed to parse data from "', pathToFile, '". Reason:', error);
      return {};
    }
  }

  private writeToFile(pathToFile: string, data: KeysToKeysToAnyValue): void {
    if (!fs.existsSync(path.dirname(pathToFile))) {
      fs.mkdirSync(path.dirname(pathToFile));
    }

    const rawData = JSON.stringify(data);
    fs.writeFileSync(pathToFile, rawData, 'utf8');
  }
}

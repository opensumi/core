import * as path from 'path';
import { Injectable, Autowired } from '@ali/common-di';
import { isWindows, Deferred, URI, AppConfig } from '@ali/ide-core-node';
import { IStoragePathServer, StoragePaths } from '../common';
import { IFileService } from '@ali/ide-file-service';

@Injectable()
export class StoragePathServer implements IStoragePathServer {
  private windowsDataFolders = [StoragePaths.WINDOWS_APP_DATA_DIR, StoragePaths.WINDOWS_ROAMING_DIR];
  // 当没有工作区被打开时，存储路径为undefined
  private cachedWorkspaceStoragePath: string | undefined;
  private cachedGlobalStoragePath: string | undefined;
  // 缓存存储路径
  private deferredWorkspaceStoragePath: Deferred<string>;
  private deferredGlobalStoragePath: Deferred<string>;
  // 当初始化完成时为true
  private workspaceStoragePathInitialized: boolean;
  private globalStoragePathInitialized: boolean;

  @Autowired(IFileService)
  private readonly fileSystem: IFileService;

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  private storageDirName: string;

  constructor() {
    this.deferredWorkspaceStoragePath = new Deferred<string>();
    this.deferredGlobalStoragePath = new Deferred<string>();
    this.workspaceStoragePathInitialized = false;
    this.globalStoragePathInitialized = false;
  }

  async provideWorkspaceStorageDirPath(storageDirName: string): Promise<string | undefined> {
    const storagePathString = await this.getBaseStorageDirPath(storageDirName);
    const uriString = URI.file(storagePathString).resolve(StoragePaths.DEFAULT_DATA_DIR_NAME).toString();

    if (!storagePathString) {
      throw new Error('Unable to get parent storage directory');
    }

    if (!await this.fileSystem.exists(uriString)) {
      await this.fileSystem.createFolder(uriString);
    }

    if (!this.workspaceStoragePathInitialized) {
      this.deferredWorkspaceStoragePath.resolve(uriString);
      this.workspaceStoragePathInitialized = true;
    }

    return this.cachedWorkspaceStoragePath = uriString;
  }

  async provideGlobalStorageDirPath(storageDirName: string): Promise<string | undefined> {
    const storagePathString = await this.getBaseStorageDirPath(storageDirName);
    const uriString = URI.file(storagePathString).toString();
    if (!storagePathString) {
      throw new Error('Unable to get parent storage directory');
    }

    if (!await this.fileSystem.exists(uriString)) {
      await this.fileSystem.createFolder(uriString);
    }

    if (!this.globalStoragePathInitialized) {
      this.deferredGlobalStoragePath.resolve(uriString);
      this.globalStoragePathInitialized = true;
    }

    return this.cachedGlobalStoragePath = uriString;
  }

  /**
   * 返回数据存储文件夹
   */
  async getBaseStorageDirPath(storageDirName?: string): Promise<string> {
    const workspaceDir = await this.getDataDirPath(storageDirName);
    return workspaceDir;
  }

  /**
   * 获取工作区存储路径
   */
  async getDataDirPath(storageDirName?: string): Promise<string> {
    const homeDir = await this.getUserHomeDir();
    const storageDir = storageDirName || StoragePaths.DEFAULT_STORAGE_DIR_NAME;
    return path.join(
      homeDir,
      ...(isWindows ? this.windowsDataFolders : ['']),
      storageDir,
    );
  }

  /**
   * 获取用户目录
   */
  private async getUserHomeDir(): Promise<string> {
    const homeDirStat = await this.fileSystem.getCurrentUserHome();
    if (!homeDirStat) {
      throw new Error('Unable to get user home directory');
    }
    const homeDirPath = await this.fileSystem.getFsPath(homeDirStat.uri);
    return homeDirPath!;
  }

  /**
   * 获取最后的工作区数据存储路径
   */
  async getLastWorkspaceStoragePath(): Promise<string | undefined> {
    if (this.workspaceStoragePathInitialized) {
      return this.cachedWorkspaceStoragePath;
    } else {
      return this.deferredWorkspaceStoragePath.promise;
    }
  }

  /**
   * 获取最后的全局数据存储路径
   */
  async getLastGlobalStoragePath(): Promise<string | undefined> {
    if (this.globalStoragePathInitialized) {
      return this.cachedGlobalStoragePath;
    } else {
      return this.deferredGlobalStoragePath.promise;
    }
  }

}

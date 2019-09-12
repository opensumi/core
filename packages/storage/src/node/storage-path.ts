import * as path from 'path';
import { Injectable, Autowired } from '@ali/common-di';
import { isWindows, Deferred, URI } from '@ali/ide-core-node';
import { IDatabaseStoragePathServer, DatabaseStoragePaths } from '../common';
import { IFileService } from '@ali/ide-file-service';

@Injectable()
export class DatabaseStoragePathServer implements IDatabaseStoragePathServer {
  private windowsDataFolders = [DatabaseStoragePaths.WINDOWS_APP_DATA_DIR, DatabaseStoragePaths.WINDOWS_ROAMING_DIR];
  // 当没有工作区被打开时，存储路径为undefined
  private cachedStoragePath: string | undefined;
  // 初始化前返回对应的Promise
  private deferredStoragePath: Deferred<string>;
  // 当初始化完成时为true
  private storagePathInitialized: boolean;

  @Autowired(IFileService)
  private readonly fileSystem: IFileService;

  constructor() {
    this.deferredStoragePath = new Deferred<string>();
    this.storagePathInitialized = false;
  }

  async provideStorageDirPath(): Promise<string | undefined> {
    const storagePathString = await this.getGlobalStorageDirPath();
    const uriString = URI.file(storagePathString).toString();

    if (!storagePathString) {
      throw new Error('Unable to get parent storage directory');
    }

    if (!await this.fileSystem.exists(uriString)) {
      await this.fileSystem.createFolder(uriString);
    }

    if (!this.storagePathInitialized) {
      this.deferredStoragePath.resolve(storagePathString);
      this.storagePathInitialized = true;
    }

    return this.cachedStoragePath = storagePathString;
  }

  /**
   * 返回数据存储文件夹
   */
  async getGlobalStorageDirPath(): Promise<string> {
    const workspaceDir = await this.getWorkspaceDataDirPath();
    return path.join(
      workspaceDir,
      DatabaseStoragePaths.GLOBAL_STORAGE_DIR,
    );
  }

  /**
   * 获取应用存储路径
   */
  async getWorkspaceDataDirPath(): Promise<string> {
    const homeDir = await this.getUserHomeDir();
    return path.join(
      homeDir,
      ...(isWindows ? this.windowsDataFolders : ['']),
      DatabaseStoragePaths.KAITIAN_DIR,
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
   * 获取最后的数据存储路径
   */
  async getLastStoragePath(): Promise<string | undefined> {
    if (this.storagePathInitialized) {
      return this.cachedStoragePath;
    } else {
      return this.deferredStoragePath.promise;
    }
  }

}

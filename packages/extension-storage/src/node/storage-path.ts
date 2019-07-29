import * as path from 'path';
import * as crypto from 'crypto';
import { Injectable, Autowired } from '@ali/common-di';
import { isWindows, URI, Deferred } from '@ali/ide-core-node';
import { IExtensionStoragePathServer, ExtensionPaths } from '../common';
import { KAITIAN_MUTI_WORKSPACE_EXT, VSCODE_MUTI_WORKSPACE_EXT, getTemporaryWorkspaceFileUri } from '@ali/ide-workspace';
import { IFileService, FileStat } from '@ali/ide-file-service';

@Injectable()
export class ExtensionStoragePathServer implements IExtensionStoragePathServer {

  private windowsDataFolders = [ExtensionPaths.WINDOWS_APP_DATA_DIR, ExtensionPaths.WINDOWS_ROAMING_DIR];
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

  async provideHostLogPath(): Promise<string> {
    const parentLogsDir = await this.getLogsDirPath();

    if (!parentLogsDir) {
      throw new Error('Unable to get parent log directory');
    }

    const extensionDirPath = path.join(parentLogsDir, this.gererateTimeFolderName(), 'host');
    await this.fileSystem.createFolder(extensionDirPath);

    return new URI(extensionDirPath).path.toString();
  }

  async provideHostStoragePath(workspace: FileStat | undefined, roots: FileStat[]): Promise<string | undefined> {
    const parentStorageDir = await this.getWorkspaceStorageDirPath();

    if (!parentStorageDir) {
      throw new Error('Unable to get parent storage directory');
    }

    if (!workspace) {
      if (!this.storagePathInitialized) {
        this.deferredStoragePath.resolve(undefined);
        this.storagePathInitialized = true;
      }
      return this.cachedStoragePath = undefined;
    }

    if (!await this.fileSystem.exists(parentStorageDir)) {
      await this.fileSystem.createFolder(parentStorageDir);
    }

    const storageDirName = await this.buildWorkspaceId(workspace, roots);
    const storageDirPath = path.join(parentStorageDir, storageDirName);
    if (!await this.fileSystem.exists(storageDirPath)) {
      await this.fileSystem.createFolder(storageDirPath);
    }

    const storagePathString = new URI(storageDirPath).path.toString();
    if (!this.storagePathInitialized) {
      this.deferredStoragePath.resolve(storagePathString);
      this.storagePathInitialized = true;
    }

    return this.cachedStoragePath = storagePathString;
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

  /**
   * 根据传入的参数构建Workspace ID
   * @param {FileStat} workspace
   * @param {FileStat[]} roots
   * @returns {Promise<string>}
   * @memberof ExtensionStoragePathImpl
   */
  async buildWorkspaceId(workspace: FileStat, roots: FileStat[]): Promise<string> {
    const homeDir = await this.getUserHomeDir();
    const untitledWorkspace = getTemporaryWorkspaceFileUri(new URI(homeDir));

    if (untitledWorkspace.toString() === workspace.uri) {
      // 当workspace为临时工作区时
      // 为每个workspace root创建一个临时存储路径
      // 服务.code-workspace, 及.kaitian-workspace这种多工作区模式
      const rootsStr = roots.map((root) => root.uri).sort().join(',');
      return crypto.createHash('md5').update(rootsStr).digest('hex');
    } else {
      const uri = new URI(workspace.uri);
      let displayName = uri.displayName;

      if ((!workspace || !workspace.isDirectory) && (displayName.endsWith(`.${KAITIAN_MUTI_WORKSPACE_EXT}`) || displayName.endsWith(`.${VSCODE_MUTI_WORKSPACE_EXT}`))) {
        displayName = displayName.slice(0, displayName.lastIndexOf('.'));
      }

      return crypto.createHash('md5').update(uri.toString()).digest('hex');
    }
  }

  /**
   * 创建时间戳文件夹，格式化YYYYMMDDTHHMMSS, 如: 20181205T093828
   */
  private gererateTimeFolderName(): string {
    return new Date().toISOString().replace(/[-:]|(\..*)/g, '');
  }

  /**
   * 获取日志路径
   */
  private async getLogsDirPath(): Promise<string> {
    const appDataDir = await this.getWorkspaceDataDirPath();
    return path.join(appDataDir, ExtensionPaths.EXTENSIONS_LOGS_DIR);
  }

  /**
   * 获取用户工作区存储路径
   */
  private async getWorkspaceStorageDirPath(): Promise<string> {
    const appDataDir = await this.getWorkspaceDataDirPath();
    return path.join(appDataDir, ExtensionPaths.EXTENSIONS_WORKSPACE_STORAGE_DIR);
  }

  /**
   * 获取应用存储路径
   */
  async getWorkspaceDataDirPath(): Promise<string> {
    const homeDir = await this.getUserHomeDir();
    return path.join(
      homeDir,
      ...(isWindows ? this.windowsDataFolders : ['']),
      ExtensionPaths.KAITIAN_DIR,
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

}

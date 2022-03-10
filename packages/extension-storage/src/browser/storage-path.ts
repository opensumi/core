import crypto from 'crypto';

import { Injectable, Autowired } from '@opensumi/di';
import { AppConfig } from '@opensumi/ide-core-browser';
import { isWindows, URI, Deferred, StoragePaths } from '@opensumi/ide-core-common';
import { Path } from '@opensumi/ide-core-common/lib/path';
import { IFileServiceClient, FileStat } from '@opensumi/ide-file-service';
import { ILoggerManagerClient } from '@opensumi/ide-logs';
import {
  DEFAULT_WORKSPACE_SUFFIX_NAME,
  WORKSPACE_USER_STORAGE_FOLDER_NAME,
  UNTITLED_WORKSPACE,
} from '@opensumi/ide-workspace';

import { IExtensionStoragePathServer } from '../common';


@Injectable()
export class ExtensionStoragePathServer implements IExtensionStoragePathServer {
  private windowsDataFolders = [StoragePaths.WINDOWS_APP_DATA_DIR, StoragePaths.WINDOWS_ROAMING_DIR];
  // 当没有工作区被打开时，存储路径为undefined
  private cachedStoragePath: URI | undefined;
  // 获取最后一次生成的工作区存储路径，初始化前返回对应的Promise
  private deferredWorkspaceStoragePath: Deferred<string | undefined>;
  // 获取顶级存储路径， 默认为 ~/.sumi, 初始化前返回对应的Promise
  private deferredStoragePath: Deferred<string | undefined>;
  // 当初始化完成时为true
  private storagePathInitialized: boolean;

  @Autowired(IFileServiceClient)
  private readonly fileSystem: IFileServiceClient;

  @Autowired(ILoggerManagerClient)
  private readonly loggerManager: ILoggerManagerClient;

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  constructor() {
    this.deferredWorkspaceStoragePath = new Deferred();
    this.deferredStoragePath = new Deferred();
    this.storagePathInitialized = false;
  }

  get workspaceSuffixName() {
    return this.appConfig.workspaceSuffixName || DEFAULT_WORKSPACE_SUFFIX_NAME;
  }

  async provideHostLogPath(): Promise<URI> {
    const parentLogsDir = await this.getLogsDirPath();
    if (!parentLogsDir) {
      throw new Error('Unable to get parent log directory');
    }
    const extensionDirPath = parentLogsDir;
    const logFsPath = URI.file(extensionDirPath).toString();
    if (!(await this.fileSystem.access(logFsPath))) {
      await this.fileSystem.createFolder(logFsPath);
    }
    return new URI(parentLogsDir);
  }

  async provideHostStoragePath(
    workspace: FileStat | undefined,
    roots: FileStat[],
    extensionStorageDirName: string,
  ): Promise<URI | undefined> {
    const parentStorageDir = await this.getWorkspaceStorageDirPath(extensionStorageDirName);

    if (!parentStorageDir) {
      throw new Error('Unable to get parent storage directory');
    }

    if (!(await this.fileSystem.access(URI.file(parentStorageDir).toString()))) {
      await this.fileSystem.createFolder(URI.file(parentStorageDir).toString());
    }

    const storageDirName = await this.buildWorkspaceId(workspace, roots, extensionStorageDirName);
    const storageDirPath = new Path(parentStorageDir).join(storageDirName).toString();
    if (!(await this.fileSystem.access(URI.file(storageDirPath).toString()))) {
      await this.fileSystem.createFolder(URI.file(storageDirPath).toString());
    }

    const storageUri = new URI(storageDirPath);
    if (!this.storagePathInitialized) {
      this.deferredWorkspaceStoragePath.resolve(storageUri.path.toString());
      this.deferredStoragePath.resolve(parentStorageDir);
      this.storagePathInitialized = true;
    }

    return (this.cachedStoragePath = storageUri);
  }

  /**
   * 获取最后使用的工作区数据存储路径
   */
  async getLastWorkspaceStoragePath(): Promise<string | undefined> {
    if (this.storagePathInitialized) {
      return this.cachedStoragePath?.path.toString();
    } else {
      return this.deferredWorkspaceStoragePath.promise;
    }
  }

  /**
   * 获取最后使用的顶级存储路径，默认为 ~/.sumi
   */
  async getLastStoragePath(): Promise<string | undefined> {
    return this.deferredStoragePath.promise;
  }

  /**
   * 根据传入的参数构建Workspace ID
   * @param {FileStat} workspace
   * @param {FileStat[]} roots
   * @returns {Promise<string>}
   * @memberof ExtensionStoragePathImpl
   */
  async buildWorkspaceId(
    workspace: FileStat | undefined,
    roots: FileStat[],
    extensionStorageDirName: string,
  ): Promise<string> {
    const homeDir = await this.getUserHomeDir();
    const getTemporaryWorkspaceFileUri = (home: URI): URI =>
      home
        .resolve(extensionStorageDirName || WORKSPACE_USER_STORAGE_FOLDER_NAME)
        .resolve(`${UNTITLED_WORKSPACE}.${this.workspaceSuffixName}`)
        .withScheme('file');
    const getTemporaryWorkspaceUri = (home: URI): URI =>
      home
        .resolve(extensionStorageDirName || WORKSPACE_USER_STORAGE_FOLDER_NAME)
        .resolve(`${UNTITLED_WORKSPACE}`)
        .withScheme('file');
    if (!workspace) {
      const untitled = getTemporaryWorkspaceUri(new URI(homeDir));
      // 当不存在工作区信息时，使用 `UNTITLED_WORKSPACE` 作为工作区
      return crypto.createHash('md5').update(untitled.toString()).digest('hex');
    }
    const untitledWorkspace = getTemporaryWorkspaceFileUri(new URI(homeDir));
    if (untitledWorkspace.toString() === workspace.uri) {
      // 当 workspace 为临时工作区时
      // 为每个 workspace root 创建一个临时存储路径
      // 服务.code-workspace, 及.sumi-workspace这种多工作区模式
      const rootsStr = roots
        .map((root) => root.uri)
        .sort()
        .join(',');
      return crypto.createHash('md5').update(rootsStr).digest('hex');
    } else {
      const uri = new URI(workspace.uri);
      return crypto.createHash('md5').update(uri.toString()).digest('hex');
    }
  }

  /**
   * 创建时间戳文件夹，格式化YYYYMMDDTHHMMSS, 如: 20181205T093828
   */
  // private gererateTimeFolderName(): string {
  //   return new Date().toISOString().replace(/[-:]|(\..*)/g, '');
  // }

  /**
   * 获取日志路径
   */
  private async getLogsDirPath(): Promise<string> {
    const logDir = await this.loggerManager.getLogFolder();
    return new Path(logDir).join(StoragePaths.EXTENSIONS_LOGS_DIR).toString();
  }

  /**
   * 获取用户工作区存储路径
   */
  private async getWorkspaceStorageDirPath(extensionStorageDirName: string): Promise<string> {
    const appDataDir = await this.getWorkspaceDataDirPath(extensionStorageDirName);
    return new Path(appDataDir).join(StoragePaths.EXTENSIONS_WORKSPACE_STORAGE_DIR).toString();
  }

  /**
   * 获取应用存储路径
   */
  async getWorkspaceDataDirPath(extensionStorageDirName: string): Promise<string> {
    const homeDir = await this.getUserHomeDir();
    const storageDirName = extensionStorageDirName;
    return new Path(homeDir).join(...(isWindows ? this.windowsDataFolders : ['']), storageDirName).toString();
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

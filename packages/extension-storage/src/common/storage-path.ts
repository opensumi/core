import { URI } from '@opensumi/ide-core-common';
import { FileStat } from '@opensumi/ide-file-service';

// 用于为各个插件创建插件配置的存储目录
export const IExtensionStoragePathServer = Symbol('IExtensionStoragePathServer');

export interface IExtensionStoragePathServer {
  // 构建插件进程的日志路径，当路径不存在时，创建该文件路径
  provideHostLogPath(): Promise<URI>;
  // 根据给定的workspace构建存储路径
  provideHostStoragePath(
    workspace: FileStat | undefined,
    roots: FileStat[],
    extensionStorageDirName: string,
  ): Promise<URI | undefined>;
  // 返回最后使用的存储路径(根据workspace生成的存储路径)
  getLastWorkspaceStoragePath(): Promise<string | undefined>;
  // 获取最后使用的顶级存储路径，默认为 ~/.sumi
  getLastStoragePath(): Promise<string | undefined>;
  // 返回数据存储文件夹
  getWorkspaceDataDirPath(extensionStorageDirName: string): Promise<string>;
}

// 可配置，通过AppConfig传入extensionStorageDirName替换
export const DEFAULT_EXTENSION_STORAGE_DIR_NAME = '.sumi';

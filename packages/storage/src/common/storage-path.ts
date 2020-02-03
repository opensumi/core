// 用于为各个插件创建插件配置的存储目录
export const IStoragePathServer = Symbol('IStoragePathServer');

export interface IStoragePathServer {
  // 返回缓存的工作区存储路径
  getLastWorkspaceStoragePath(): Promise<string | undefined>;
  // 返回缓存的全局存储路径
  getLastGlobalStoragePath(): Promise<string | undefined>;
  // 提供对应storageName的工作区文件夹存储路径
  provideWorkspaceStorageDirPath(storageDirName?: string): Promise<string | undefined>;
  // 提供对应storageName的全局文件夹存储路径
  provideGlobalStorageDirPath(storageDirName?: string): Promise<string | undefined>;
}

// 用于为各个插件创建插件配置的存储目录
export const IDatabaseStoragePathServer = Symbol('IStoragePathServer');

export interface IDatabaseStoragePathServer {
  // 返回缓存的存储路径
  getLastStoragePath(): Promise<string | undefined>;
  // 提供对应storageName的存储文件夹路径
  provideStorageDirPath(): Promise<string | undefined>;
  // 返回数据存储文件夹
  getGlobalStorageDirPath(): Promise<string>;
}

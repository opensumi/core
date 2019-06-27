import { URI, Event } from '@ali/ide-core-common';
import { Version } from './version';

/**
 * 文件引用反映了文件的当前版本号。
 */
export interface IRawFileReference {
  /**
   * 文件地址。
   */
  uri: URI;
  /**
   * 文件版本号。
   */
  version: Version;
  /**
   * 文件引用生成到下一个版本号。
   */
  nextVersion(): IRawFileReference;
}

/**
 * 文件引用管理器。
 */
export interface IRawFileReferenceManager {
  /**
   * 初始化一个新的文件引用。
   * @param uri 文件地址
   */
  initReference(uri: string | URI): IRawFileReference;
  /**
   * 获取一个文件引用。
   * @param uri 文件地址
   */
  getReference(uri: string | URI): IRawFileReference;
  /**
   * 移除一个文件引用。
   * @param uri 文件地址
   */
  removeReference(uri: string | URI): void;
}

/**
 * 文件引用监听服务。
 */
export interface IRawFileWatchService {
  /**
   * 开始监听一个文件。
   * @param uri 文件地址
   */
  watch(uri: string | URI): Promise<void>;
  /**
   * 停止监听一个文件。
   * @param uri 文件地址
   */
  unwatch(uri: string | URI): Promise<void>;
  /**
   * 文件更新事件。
   */
  onChanged: Event<IRawFileReference>;
  /**
   * 文件创建事件。
   */
  onCreated: Event<IRawFileReference>;
  /**
   * 文件移除事件。
   */
  onRemoved: Event<IRawFileReference>;
}

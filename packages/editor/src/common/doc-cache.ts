import { URI, MaybePromise } from '@opensumi/ide-core-common';
import { Range } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';
import type { IModelContentChange } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model/textModelEvents';

interface IDocBasicCacheData {
  path: string;
  startMD5: string;
}

export interface IDocContentCache extends IDocBasicCacheData {
  content: string;
}

export type IDocCacheValue = [
  string, // text
  number, // startLineNumber
  number, // startColumn
  number, // endLineNumber
  number, // endColumn
];

export interface IDocChangesCache extends IDocBasicCacheData {
  changeMatrix: IDocCacheValue[][];
}

export type IDocCache = IDocContentCache | IDocChangesCache;

export interface IDocStatus {
  /**
   * 是否有内容变化，由回退造成的无内容变化的时候，仍然有 change 发过来
   */
  dirty: boolean;

  /**
   * 文档一开始的 MD5 值
   */
  startMD5: string;

  /**
   * 文档的完整内容
   */
  content: string;

  /**
   * 从文档开始的 MD5 内容到现在的所有变化内容
   */
  changeMatrix: IModelContentChange[][];

  /**
   * 文档的编码格式
   */
  encoding?: string;
}

export const IDocPersistentCacheProvider = Symbol('IDocPersistentCacheProvider');
export interface IDocPersistentCacheProvider {
  /**
   * 判断某个文档是否有缓存数据
   * 1. 业务方可以提前装载缓存列表，所以让这个方法成为同步的
   * 2. 如果实在是不想提前装载，可以始终返回 true，通过查询缓存进行异步调用
   * @param uri
   */
  hasCache(uri: URI): boolean;

  /**
   * 判断是否已经完成所有的临时文件存储，如果未完成此处返回false，会阻止用户关闭窗口
   */
  isFlushed(): boolean;

  /**
   * 获取某个文档的缓存数据，可以有以下的缓存方式：
   * 1. Web 上面使用 localStorage 进行同步缓存存储
   * 2. Web 上面调用后端 API 进行异步缓存存储
   * 3. 桌面客户端，调用文件 API 进行同步缓存存储
   * @param uri
   * @param encoding
   */
  getCache(uri: URI, encoding?: string): MaybePromise<IDocCache | null>;

  /**
   * 当文件内容发生变化的时候，进行缓存持久化存储，实现方可以选择以下的处理逻辑：
   * 1. 缓存整个文件内容，或者缓存差异内容
   * 2. 当文件状态发生变化的时候，文档有 change 的时候，存储缓存；文档被保存没有 change 的时候，删除缓存
   * @param uri
   * @param status
   */
  persistCache(uri: URI, status: IDocStatus): void;
}

export function isDocContentCache(cache: IDocCache): cache is IDocContentCache {
  return cache.hasOwnProperty('content');
}

export function isDocChangesCache(cache: IDocCache): cache is IDocChangesCache {
  return cache.hasOwnProperty('changeMatrix');
}

export function parseCacheValueFrom(change: IModelContentChange): IDocCacheValue {
  const text = change.text;
  const startLineNumber = change.range.startLineNumber;
  const startColumn = change.range.startColumn;
  const endLineNumber = change.range.endLineNumber;
  const endColumn = change.range.endColumn;

  return [text, startLineNumber, startColumn, endLineNumber, endColumn];
}

export function parseRangeFrom(cacheValue: IDocCacheValue): Range {
  const [_text, startLineNumber, startColumn, endLineNumber, endColumn] = cacheValue;

  return Range.lift({
    startLineNumber,
    startColumn,
    endLineNumber,
    endColumn,
  });
}

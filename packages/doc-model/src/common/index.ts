import {
  URI, IDisposable,
} from '@ali/ide-core-common';
import {
  IDocumentModelMirror, IDocumentModeContentProvider, IDocumentModelStatMirror,
} from './doc';

export * from './const';
export * from './version';
export * from './doc';

export interface INodeDocumentService {
  /**
   * 从本地空间获取一个文件的详细信息。
   * @param uri 文件地址
   */
  resolve(uri: string): Promise<IDocumentModelMirror| null>;
  /**
   * 将文本文档的修改持久化到本地空间的操作。
   * @param uri
   * @param stack
   * @param override
   */
  persist(stat: IDocumentModelStatMirror, stack: Array<monaco.editor.IModelContentChange>, override?: boolean): Promise<IDocumentModelStatMirror | null>;
}

export interface IBrowserDocumentService {
  /**
   * node 端向前台请求更新指定文档内容的事件方法
   */
  updateContent(mirror: IDocumentModelMirror): Promise<void>;
  /**
   * node 端向前台更新一个文件已被删除的状态
   * @param uri 文件原地址
   */
  updateFileRemoved(uri: string): Promise<void>;
}

export const BrowserDocumentModelContribution = Symbol('BrowserDocumentModelContribution');

export interface BrowserDocumentModelContribution {
  /**
   * 注册文本源数据的提供商
   * @param provider
   */
  registerDocModelContentProvider(provider: IDocumentModeContentProvider): IDisposable;
}

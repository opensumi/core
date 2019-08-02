import {
  URI,
  IDisposable,
  IDisposableRef,
  Event,
} from '@ali/ide-core-common';
import {
  IVersion,
  Version,
} from './version';

/**
 * 文本文档的静态映射。
 */
export interface IDocumentModelMirror {
  /**
   * 文本文件地址。
   */
  uri: string;
  /**
   * 文本文件内容。
   */
  lines: string[];
  /**
   * 文本文件断行。
   */
  eol: string;
  /**
   * 文本文件编码。
   */
  encoding: string;
  /**
   * 文本文件语言。
   */
  language: string;
  /**
   * 文本文件的基版本。
   */
  base: IVersion;
  /**
   * 是否只读
   */
  readonly?: boolean;
}

/**
 * 文本文档的状态映射，不包含文本内容
 */
export interface IDocumentModelStatMirror {
  /**
   * 文本文件地址。
   */
  uri: string;
  /**
   * 文本文件断行。
   */
  eol: string;
  /**
   * 文本文件编码。
   */
  encoding: string;
  /**
   * 文本文件语言。
   */
  language: string;
  /**
   * 文本文件的基版本。
   */
  base: IVersion;
}

/**
 * 文本文档的浏览器映射副本
 */
export interface IDocumentModel extends IDisposableRef<IDocumentModel> {
  /**
   * 文本文档地址
   */
  uri: URI;
  /**
   * 文本文件内容
   */
  lines: string[];
  /**
   * 文本文档断行
   */
  eol: string;
  /**
   * 文本文档编码
   */
  encoding: string;
  /**
   * 是否为只读
   */
  readonly: boolean;
  /**
   * 文本文档语言
   */
  language: string;
  /**
   * 文本文档版本号，
   * 可能为基版号，也可能是编辑器版本号，
   * 当此版本为基版本类型的时候，如果与基版本一致，则为非 dirty 状态，
   * 当此版本为基版本类型的时候，如果与基本不不一致，则这个文件需要一次从外部修改的更新操作，
   * 当此版本为编辑器版本类型，则此文件为 dirty 文件，不执行更新操作。
   */
  version: Version;
  /**
   * 文本文档的基版本号
   */
  baseVersion: Version;
  /**
   * 文件的 dirty 状态
   */
  dirty: boolean;
  /**
   * 文档的修改栈
   */
  changesStack: Array<monaco.editor.IModelContentChange>;
  /**
   * @param content 文件内容
   */
  setValue(content: string): void;
  /**
   * 将文件修改执行到文件内容缓存中，
   * 会触发文件内容修改的事件。
   * @param changes 文件修改
   */
  applyChanges(changes: monaco.editor.IModelContentChange[]): void;
  /**
   * 从文件缓存中获取一段文件内容，也可能是全部文件内容
   * @param range
   */
  getText(range?: IMonacoRange): string;
  /**
   * 全量更新文件缓存的内容，会触发文件内容修改的事件，
   * 同时也会更新 moanco 内置文档的内容。
   * @param content 文件缓存更新的内容
   */
  updateContent(content: string): void;
  /**
   * 将文本文档转化为一个 monaco 的内置数据类型
   */
  toEditor(): monaco.editor.IModel;
  /**
   * 将文本文档转化为一个可序列化的静态对象
   */
  toMirror(): IDocumentModelMirror;
  /**
   * 将文本文档转化为一个可序列化的静态对象，不包含文件内容
   */
  toStatMirror(): IDocumentModelStatMirror;
  /**
   * 将文档更新到新的版本号。
   * @param version 版本号实例
   */
  forward(version: Version): void;
  /**
   * 合并基版本和文档版本到新的版本号。
   * @param version 版本号实例
   */
  merge(version: Version): void;
  /**
   * 更新基版本到新的版本号
   * @param version 版本号实例
   */
  rebase(version: Version): void;
  /**
   * 将文档标记为虚拟文档，
   * 这个时候说明本地空间的源文件已被移除，
   * 基版本和当前版本的版本类型都将是 browser 类型
   */
  virtual(): void;
  /**
   * 当发生了一次合并操作的时候触发的事件
   */
  onMerged: Event<IDocumentVersionChangedEvent>;
  /**
   * 当文档文本内容发生变化的时候触发的事件
   */
  onContentChanged: Event<IDocumentContentChangedEvent>;
  /**
   * 当文档文本语言发生改变的时候触发的事件
   */
  onLanguageChanged: Event<IDocumentLanguageChangedEvent>;
  /**
   * 文本文档被析构时触发的事件
   */
  onDispose: Event<void>;
}

export const IDocumentModelManager = Symbol('DocumentModelManager');
/**
 * 文本文档副本的管理器
 */
export interface IDocumentModelManager extends IDisposable {
  /**
   * 获取一个文本文档，
   * 当文档尚不存在的时候，会从本地文件创建一个新的副本。
   * @param uri 文件地址
   */
  resolveModel(uri: string | URI): Promise<IDocumentModel>;
  /**
   * 搜索一个文本文档，可能为空
   * @param uri 文件地址
   */
  searchModel(uri: string | URI): Promise<IDocumentModel | null>;
  /**
   * 保存文本文档的修改到本地空间，
   * TODO: 将全量修改优化为局部修改。
   * @param uri 文件地址
   */
  saveModel(uri: string | URI): Promise<boolean>;
  /**
   * 全量更新一个文本文档的缓存内容，
   * 只更新内容，不会更新版本号。
   * @param uri 文件地址
   * @param content 更新的文本内容
   */
  updateContent(uri: string | URI, content: string): Promise<IDocumentModel>;
  /**
   * 注册文本源数据的提供商
   * @param provider
   */
  registerDocModelContentProvider(provider: IDocumentModelContentProvider): IDisposable;

  /**
   * 返回所有的文本文档
   * @returns {Map<string, IDocumentModel>}
   * @memberof IDocumentModelManager
   */
  getAllModel(): Map<string, IDocumentModel>;
}

/**
 * 文本文档发生改变时触发的事件
 */
export interface IDocumentChangedEvent {
  uri: URI;
  mirror: IDocumentModelMirror;
}

/**
 * 文本文档被创建时触发的事件
 */
export interface IDocumentCreatedEvent {
  uri: URI;
  mirror: IDocumentModelMirror;
}

/**
 * 文本文档被移除时触发的事件
 */
export interface IDocumentRemovedEvent {
  uri: URI;
}

/**
 * 文本文档被重命名时触发的事件
 */
export interface IDocumentRenamedEvent {
  from: URI;
  to: URI;
}

export interface IDocumentModelContentProvider {
  build: (uri: URI) => Promise<IDocumentModelMirror | undefined | null>;
  persist: (stat: IDocumentModelStatMirror, stack: Array<monaco.editor.IModelContentChange>, override: boolean) => Promise<IDocumentModelStatMirror | null>;

  // event
  onCreated: Event<IDocumentCreatedEvent>;
  onChanged: Event<IDocumentChangedEvent>;
  onRenamed: Event<IDocumentRenamedEvent>;
  onRemoved: Event<IDocumentRemovedEvent>;
}

/**
 * monaco range start with 1
 */
export interface IMonacoRange {
  startLineNumber: number;
  endLineNumber: number;
  startColumn: number;
  endColumn: number;
}

/**
 * document range start with 0
 */
export interface IDocumentModelRange {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

export interface IDocumentVersionChangedEvent {
  from: Version;
  to: Version;
}

export interface IDocumentLanguageChangedEvent {
  from: string;
  to: string;
}

export interface IDocumentModelContentChange {
  range: IMonacoRange;
  text: string;
  rangeLength: number;
  rangeOffset: number;
}

export interface IDocumentContentChangedEvent {
  changes: IDocumentModelContentChange[];
}

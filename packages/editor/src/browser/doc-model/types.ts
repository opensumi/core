import { URI, MaybePromise, IRef, IDisposable, Event, IRange, BasicEvent, IEditOperation, IEditorDocumentChange, IEditorDocumentModelSaveResult} from '@ali/ide-core-browser';
import { EOL, EndOfLineSequence } from '../../common';
/**
 * editorDocumentModel is a wrapped concept for monaco's textModel
 */
export interface IEditorDocumentModel {

  /**
   * 文档URI
   */
  readonly uri: URI;

  /**
   * 编码
   */
  encoding: string;

  /**
   * 行末结束
   */
  eol: EOL;

  /**
   * 语言Id
   */
  languageId: string;

  /**
   * 是否被修改过
   */
  readonly dirty: boolean;

  /**
   * 能否修改
   */
  readonly readonly: boolean;

  /**
   * 能否保存
   */
  readonly savable: boolean;

  /**
   * 获得monaco的TextModel
   */
  getMonacoModel(): monaco.editor.ITextModel;

  /**
   *  保存文档, 如果文档不可保存，则不会有任何反应
   *  @param force 强制保存, 不管diff
   */
  save(force?: boolean): Promise<boolean>;

  /**
   * 恢复文件内容
   */
  revert(): Promise<void>;

  getText(range?: IRange): string;

  updateContent(content: string, eol?: EOL): void;

}

export interface IEditorDocumentModelContentProvider {

  /**
   * 是否处理这个Scheme的uri
   * @param scheme
   */
  handlesScheme(scheme: string): MaybePromise<boolean>;

  /**
   * 提供文档内容
   * // TODO 支持TextBuffer以打开大型文件
   * @param uri
   * @param encoding 以某种编码获取内容
   */
  provideEditorDocumentModelContent(uri: URI, encoding?: string): MaybePromise<string>;

  /**
   * 这个文档是否只读（注意只读和无法保存的区别）
   * @param uri
   */
  isReadonly(uri: URI): MaybePromise<boolean>;

  /**
   * 保存一个文档, 如果不存在这个方法，那这个文档无法被保存
   * 当文档无法保存时, 文档永远不会进入dirty状态，并且来自provider的
   * @param uri
   * @param content
   * @param baseContent dirty前的内容
   * @param ignoreDiff 无视diff错误, 强行覆盖保存
   */
  saveDocumentModel?(uri: URI, content: string, baseContent: string, changes: IEditorDocumentChange[], encoding?: string, ignoreDiff?: boolean): MaybePromise<IEditorDocumentModelSaveResult>;

  /**
   * 为一个uri提供喜好的语言id，返回undefined则交由编辑器自己去判断
   * @param uri
   */
  preferLanguageForUri?(uri: URI): MaybePromise<string | undefined>;

  provideEOL?(uri: URI): MaybePromise<EOL>;

  /**
   * 提供这个文件当前内容的md5值，如果不实现这个函数，会使用content再执行计算
   * @param uri
   */
  provideEditorDocumentModelContentMd5?(uri: URI, encoding?: string): MaybePromise<string | undefined>;

  /**
   * 文档内容变更事件，交由modelManager决定是否处理
   */
  onDidChangeContent: Event<URI>;

  onDidDisposeModel?(uri: URI): void;

}

export type IEditorDocumentModelRef = IRef<IEditorDocumentModel>;

export interface IEditorDocumentModelService {

  createModelReference(uri: URI, reason?: string): Promise<IEditorDocumentModelRef>;

  /**
   * 获取一个文本文档，
   * 当文档从来没有被打开过时，返回null
  */
  getModelReference(uri: URI, reason?: string): IEditorDocumentModelRef | null;

  /**
    * 获得全部model
  */
  getAllModels(): IEditorDocumentModel[];

}

export const IEditorDocumentModelService = Symbol('IEditorDocumentModelService');

export interface IEditorDocumentModelContentRegistry {

  /**
  * 注册文本源数据的提供商
  * @param provider
  */
  registerEditorDocumentModelContentProvider(provider: IEditorDocumentModelContentProvider): IDisposable;

  getProvider(uri: URI): IEditorDocumentModelContentProvider | undefined;

  getContentForUri(uri: URI, encoding?: string): Promise<string>;

}

export const IEditorDocumentModelContentRegistry = Symbol('IEditorDocumentModelContentRegistry');

// events;

export class EditorDocumentModelContentChangedEvent extends BasicEvent<IEditorDocumentModelContentChangedEventPayload> {}

export interface IEditorDocumentModelContentChangedEventPayload {
  uri: URI;
  dirty: boolean;
  changes: IEditorDocumentModelContentChange[];
  eol: string;
  versionId: number;
}

export class EditorDocumentModelOptionChangedEvent extends BasicEvent<IEditorDocumentModelOptionChangedEventPayload> {}

export class EditorDocumentModelOptionExternalUpdatedEvent  extends BasicEvent<URI> {}

export interface IEditorDocumentModelOptionChangedEventPayload {
  uri: URI;
  encoding?: string;
  languageId?: string;
}

export interface IEditorDocumentModelContentChange {
  range: IRange;
  text: string;
  rangeLength: number;
  rangeOffset: number;
}

export class EditorDocumentModelCreationEvent extends BasicEvent<IEditorDocumentModelCreationEventPayload> {}

export interface IEditorDocumentModelCreationEventPayload {
  versionId: number;
  uri: URI;
  content: string;
  eol: EOL;
  encoding: string;
  languageId: string;
  readonly: boolean;
}

export class EditorDocumentModelRemovalEvent extends BasicEvent<URI> {}

export class EditorDocumentModelSavedEvent extends BasicEvent<URI> {}

export interface IStackElement {
  readonly beforeVersionId: number;
  readonly beforeCursorState: Selection[] | null;
  readonly afterCursorState: Selection[] | null;
  readonly afterVersionId: number;
}

export interface IEditStackElement extends IStackElement {
  readonly beforeVersionId: number;
  readonly beforeCursorState: Selection[];
  afterCursorState: Selection[] | null;
  afterVersionId: number;

  editOperations: Array<{operations: IEditOperation[]}>;
}

export interface IEOLStackElement extends IStackElement {
  readonly beforeVersionId: number;
  readonly beforeCursorState: Selection[] | null;
  readonly afterCursorState: Selection[] | null;
  afterVersionId: number;

  eol: EndOfLineSequence;
}

// original_doc://?target=file://aaa.js
export const ORIGINAL_DOC_SCHEME = 'original_doc';

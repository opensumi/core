import {
  URI,
  MaybePromise,
  IRef,
  IDisposable,
  Event,
  IRange,
  BasicEvent,
  IEditOperation,
  IEditorDocumentChange,
  IEditorDocumentModelSaveResult,
} from '@opensumi/ide-core-browser';
import { EndOfLineSequence, EOL, ITextModel } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import { IEditorDocumentModelContentChange, SaveReason } from '../../common';

/**
 * editorDocumentModel is a wrapped concept for monaco's textModel
 */
export interface IEditorDocumentModel extends IDisposable {
  /**
   * 文档URI
   */
  readonly uri: URI;

  /**
   * A unique identifier associated with this model.
   */
  id: string;

  /**
   * 编码
   */
  encoding: string;

  /**
   * An event emitted when the model's encoding have changed.
   * @event
   */
  onDidChangeEncoding: Event<void>;

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
   * 是否永远都显示 dirty
   */
  readonly alwaysDirty: boolean;

  /**
   * 是否关闭自动保存功能
   */
  readonly closeAutoSave: boolean;

  /**
   * 获得monaco的TextModel
   */
  getMonacoModel(): ITextModel;

  /**
   *  保存文档, 如果文档不可保存，则不会有任何反应
   *  @param force 强制保存, 不管diff
   */
  save(force?: boolean, reason?: SaveReason): Promise<boolean>;

  /**
   * 恢复文件内容
   * @param notOnDisk 文档已经不存在磁盘
   */
  revert(notOnDisk?: boolean): Promise<void>;

  getText(range?: IRange): string;

  updateContent(content: string, eol?: EOL): void;

  updateEncoding(encoding: string): Promise<void>;

  // setEncoding(encoding: string, preferredEncoding, mode: EncodingMode): Promise<void>;

  updateOptions(options: IDocModelUpdateOptions);
}

export interface IDocModelUpdateOptions extends monaco.editor.ITextModelUpdateOptions {
  detectIndentation?: boolean;
}

export interface IEditorDocumentModelContentProvider {
  /**
   * 是否处理这个Scheme的uri
   * 权重等级等同于 handlesUri => 10
   * @param scheme
   */
  handlesScheme?(scheme: string): MaybePromise<boolean>;

  /**
   * 处理一个URI的权重, -1表示不处理, 如果存在handlesUri, handlesScheme将被忽略
   * @param scheme
   */
  handlesUri?(uri: URI): MaybePromise<number>;

  /**
   * 提供文档内容
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
  saveDocumentModel?(
    uri: URI,
    content: string,
    baseContent: string,
    changes: IEditorDocumentChange[],
    encoding?: string,
    ignoreDiff?: boolean,
    eol?: EOL,
  ): MaybePromise<IEditorDocumentModelSaveResult>;

  /**
   * 为一个uri提供喜好的语言id，返回undefined则交由编辑器自己去判断
   * @param uri
   */
  preferLanguageForUri?(uri: URI): MaybePromise<string | undefined>;

  provideEOL?(uri: URI): MaybePromise<EOL>;

  /**
   * 为一个uri提供encoding信息, 如果不实现，则默认UTF-8
   * @param uri;
   */
  provideEncoding?(uri: URI): MaybePromise<string>;

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

  /**
   * 是否永远显示 dirty
   * 有些类型的文档(untitled)可能刚创建就是 dirty，允许它以空文件的状态保存
   */
  isAlwaysDirty?(uri: URI): MaybePromise<boolean>;

  /**
   * 是否关闭自动保存功能
   */
  closeAutoSave?(uri: URI): MaybePromise<boolean>;

  /**
   * 猜测编码
   */
  guessEncoding?(uri: URI): Promise<string | undefined>;
}

export interface IPreferredModelOptions {
  encoding?: string;
  languageId?: string;
  eol?: EOL;
}

export type IEditorDocumentModelRef = IRef<IEditorDocumentModel>;

export interface IEditorDocumentModelService {
  hasLanguage(languageId: string): boolean;

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

  /**
   * 修改某个uri的option （会存储在偏好内）
   * @param uri
   * @param options
   */
  changeModelOptions(uri: URI, options: IPreferredModelOptions);

  saveEditorDocumentModel(
    uri: URI,
    content: string,
    baseContent: string,
    changes: IEditorDocumentChange[],
    encoding?: string,
    ignoreDiff?: boolean,
  ): MaybePromise<IEditorDocumentModelSaveResult>;
}

export const IEditorDocumentModelService = Symbol('IEditorDocumentModelService');

export interface IEditorDocumentModelContentRegistry {
  /**
   * 注册文本源数据的提供商
   * @param provider
   */
  registerEditorDocumentModelContentProvider(provider: IEditorDocumentModelContentProvider): IDisposable;

  getProvider(uri: URI): Promise<IEditorDocumentModelContentProvider | undefined>;

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
  isRedoing: boolean;
  isUndoing: boolean;
}

export class EditorDocumentModelOptionChangedEvent extends BasicEvent<IEditorDocumentModelOptionChangedEventPayload> {}

export class EditorDocumentModelOptionExternalUpdatedEvent extends BasicEvent<URI> {}

export interface IEditorDocumentModelOptionChangedEventPayload {
  uri: URI;
  encoding?: string;
  languageId?: string;
  eol?: EOL;
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

export class EditorDocumentModelWillSaveEvent extends BasicEvent<{
  uri: URI;
  reason: SaveReason;
  language: string;
}> {}
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

  editOperations: Array<{ operations: IEditOperation[] }>;
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

export const enum EncodingMode {
  /**
   * Instructs the encoding support to encode the current input with the provided encoding
   */
  Encode,

  /**
   * Instructs the encoding support to decode the current input with the provided encoding
   */
  Decode,
}

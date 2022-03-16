import { Injectable } from '@opensumi/di';
import { IScopedContextKeyService } from '@opensumi/ide-core-browser';
import {
  URI,
  Event,
  BasicEvent,
  IDisposable,
  MaybeNull,
  IRange,
  ISelection,
  ILineChange,
  IPosition,
  IThemeColor,
  IMarkdownString,
} from '@opensumi/ide-core-common';
// eslint-disable-next-line import/no-restricted-paths
import type { ICodeEditor as IMonacoCodeEditor } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';
import type { IEditorOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/common/config/editorOptions';
import type { ITextModelUpdateOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';

// eslint-disable-next-line import/no-restricted-paths
import type { IEditorDocumentModel, IEditorDocumentModelRef } from '../browser';

import { IResource } from './resource';

export interface CursorStatus {
  position: MaybeNull<IPosition>;
  selectionLength: number;
}

export enum EditorType {
  /**
   * 普通编辑器
   */
  CODE,
  /**
   * 原始对比编辑器(左侧)
   */
  ORIGINAL_DIFF,
  /**
   * 修改对比编辑器(右侧)
   */
  MODIFIED_DIFF,
}

/**
 * 一个IEditor代表了一个最小的编辑器单元，可以是CodeEditor中的一个，也可以是DiffEditor中的两个
 */
export interface IEditor {
  /**
   * 获得当前编辑器
   */
  getId(): string;

  /**
   * 获得编辑器的类型
   */
  getType(): EditorType;

  /**
   * editor中打开的documentModel
   */

  currentDocumentModel: IEditorDocumentModel | null;

  /**
   * 当前的uri
   */
  currentUri: URI | null;

  /**
   * 插入代码片段
   * @param template
   * @param ranges
   * @param opts
   */
  insertSnippet(template: string, ranges: readonly IRange[], opts: IUndoStopOptions);

  /**
   * 应用装饰器
   * @param key
   * @param options
   */
  applyDecoration(key: string, options: IDecorationApplyOptions[]);

  getSelections(): ISelection[] | null;

  onSelectionsChanged: Event<{ selections: ISelection[]; source: string }>;

  onVisibleRangesChanged: Event<IRange[]>;

  onConfigurationChanged: Event<void>;

  setSelections(selection: IRange[] | ISelection[]);

  setSelection(selection: IRange | ISelection);

  updateOptions(editorOptions?: IEditorOptions, modelOptions?: ITextModelUpdateOptions);

  save(): Promise<void>;

  /**
   * 获得包裹的 monaco 编辑器
   */
  monacoEditor: IMonacoCodeEditor;

  onDispose: Event<void>;

  onFocus: Event<void>;

  onBlur: Event<void>;
}

export interface IUndoStopOptions {
  undoStopBefore: boolean;
  undoStopAfter: boolean;
}

export interface ICodeEditor extends IEditor, IDisposable {
  layout(): void;

  /**
   * 打开一个 document
   * @param uri
   */
  open(documentModelRef: IEditorDocumentModelRef, range?: IRange): Promise<void>;

  focus(): void;

  onCursorPositionChanged: Event<CursorStatus>;

  onRefOpen: Event<IEditorDocumentModelRef>;
}

/**
 * Diff 编辑器抽象
 */
export interface IDiffEditor extends IDisposable {
  compare(
    originalDocModelRef: IEditorDocumentModelRef,
    modifiedDocModelRef: IEditorDocumentModelRef,
    options?: IResourceOpenOptions,
    rawUri?: URI,
  );

  originalEditor: IEditor;

  modifiedEditor: IEditor;

  layout(): void;

  focus(): void;

  getLineChanges(): ILineChange[] | null;
}

@Injectable()
export abstract class EditorCollectionService {
  /**
   * 当前的编辑器
   */
  public readonly currentEditor: IEditor | undefined;

  /**
   * 创建一个 monaco 编辑器实例
   * @param dom
   * @param options
   * @param overrides
   */
  public abstract createCodeEditor(dom: HTMLElement, options?: any, overrides?: { [key: string]: any }): ICodeEditor;

  /**
   * 创建一个 monaco diffEditor 实例
   * @param dom
   * @param options
   * @param overrides
   */
  public abstract createDiffEditor(dom: HTMLElement, options?: any, overrides?: { [key: string]: any }): IDiffEditor;

  public abstract listEditors(): IEditor[];
  public abstract listDiffEditors(): IDiffEditor[];

  public abstract onCodeEditorCreate: Event<ICodeEditor>;
  public abstract onDiffEditorCreate: Event<IDiffEditor>;
}

export type IOpenResourceResult = { group: IEditorGroup; resource: IResource } | false;
/**
 * 当前显示的Editor列表发生变化时
 */
export class CollectionEditorsUpdateEvent extends BasicEvent<IEditor[]> {}

/**
 * 当EditorGroup中打开的uri发生改变时
 */
export class DidChangeEditorGroupUriEvent extends BasicEvent<URI[][]> {}

/**
 * 当 Decoration Provider 收集完 monaco decoration option 并设置后
 */
export class DidApplyEditorDecorationFromProvider extends BasicEvent<{ key?: string; uri: URI }> {}

/**
 * 编辑器组
 * 是一组tab和一个展示编辑器或者编辑器富组件的单元，主要用来管理 tab 的生命周期，以及控制编辑器主体的展示。
 * 一个 workbenchEditorService 会拥有多个（至少一个）编辑器组，它会在类似 “向右拆分” 这样的功能被使用时创建，在该组tab完全关闭时销毁。
 */
export interface IEditorGroup {
  /**
   * 当前 editorGroup 在 workbenchEditorService.sortedEditorGroups 中的 index
   */
  index: number;

  /**
   * 当前 editorGroup 的名称，唯一，可视作 id
   */
  name: string;

  /**
   * 每个编辑器组拥有一个代码编辑器和一个diff编辑器实例
   * 当前group的代码编辑器
   */
  codeEditor: ICodeEditor;

  /**
   * 当前group的diff编辑器实例
   */
  diffEditor: IDiffEditor;

  /**
   * 当前的编辑器 （如果当前是富组件，则返回 null)
   */
  currentEditor: IEditor | null;

  /**
   * 和currentEditor不同，对于diffEditor来说会取确实在focus的Editor
   */
  currentOrPreviousFocusedEditor: IEditor | null;

  currentFocusedEditor: IEditor | null;
  /**
   * 所有当前编辑器租的 tab 的资源
   */
  resources: IResource[];

  /**
   * 当前的 tab 对应的资源
   */
  currentResource: MaybeNull<IResource>;

  /**
   * 当前的打开方式
   */
  currentOpenType: MaybeNull<IEditorOpenType>;

  onDidEditorGroupContentLoading: Event<IResource>;

  resourceStatus: Map<IResource, Promise<void>>;

  open(uri: URI, options?: IResourceOpenOptions): Promise<IOpenResourceResult>;

  /**
   * 取消指定 uri 的 tab 的 preview模式（斜体模式），如果它是的话
   * @param uri
   */
  pin(uri: URI): Promise<void>;

  /**
   * 关闭指定的 uri 的 tab， 如果存在的话
   * @param uri
   */
  close(uri: URI): Promise<void>;

  getState(): IEditorGroupState;

  restoreState(IEditorGroupState): Promise<void>;

  saveAll(): Promise<void>;

  closeAll(): Promise<void>;

  /**
   * 保存当前的 tab 的文件 (如果它能被保存的话)
   */
  saveCurrent(reason?: SaveReason): Promise<void>;

  /**
   * 保存某个 resource
   * @param resource
   * @param reason
   */
  saveResource(resource: IResource, reason: SaveReason): Promise<void>;
}
export abstract class WorkbenchEditorService {
  /**
   * 当前 resource 发生变更
   */
  onActiveResourceChange: Event<MaybeNull<IResource>>;

  /**
   * 当前编辑器内鼠标
   */
  onCursorChange: Event<CursorStatus>;

  /**
   * 编辑器组发生改变时的事件
   */
  onDidEditorGroupsChanged: Event<void>;

  /**
   * 当前 editorGroup 发生改变的事件
   */
  onDidCurrentEditorGroupChanged: Event<IEditorGroup>;

  /**
   * 所有的编辑器组
   */
  editorGroups: IEditorGroup[];

  /**
   *
   */
  sortedEditorGroups: IEditorGroup[];

  /**
   * 当前的编辑器对象
   */
  currentEditor: IEditor | null;

  /**
   * 当前焦点的编辑器资源
   */
  currentResource: MaybeNull<IResource>;

  /**
   * 当前的编辑器组
   */
  currentEditorGroup: IEditorGroup;

  /**
   * 关闭全部
   * @param uri 只关闭指定的 uri
   * @param force 不进行关闭前提醒（不执行 shouldCloseResource)
   */
  abstract closeAll(uri?: URI, force?: boolean): Promise<void>;

  /**
   * 打开指定的 uri
   * @param uri
   * @param options 打开的选项
   */
  abstract open(uri: URI, options?: IResourceOpenOptions): Promise<IOpenResourceResult>;

  /**
   * 打开多个 uri
   * @param uri
   */
  abstract openUris(uri: URI[]): Promise<void>;

  /**
   * 保存全部
   * @param includeUntitled 是否对新文件进行保存询问, 默认false
   */
  abstract saveAll(includeUntitled?: boolean): Promise<void>;

  /**
   * 关闭指定的 uri， 等同于 closeAll 带 uri 参数
   * @param uri
   * @param force
   */
  abstract close(uri: any, force?: boolean): Promise<void>;

  /**
   * 获得当前打开的 uri
   */
  abstract getAllOpenedUris(): URI[];

  /**
   * 创建一个带待存的资源
   * @param options
   */
  abstract createUntitledResource(options?: IUntitledOptions): Promise<IOpenResourceResult>;

  abstract setEditorContextKeyService(contextKeyService: IScopedContextKeyService): void;
}

export interface IUntitledOptions extends IResourceOpenOptions {
  uri: URI;
  resourceOpenOptions?: IResourceOpenOptions;
}

export interface IResourceOpenOptions {
  /**
   * 跳转到指定的编辑器位置
   */
  range?: Partial<IRange>;

  scrollTop?: number;
  scrollLeft?: number;

  // 如果打开的是 diff 编辑器，可以指定 original editor 的 range
  originalRange?: Partial<IRange>;

  /**
   * 打开的tab在本组编辑器中的位置
   */
  index?: number;

  /**
   * 是否不自动切换到这个打开的 tab，
   */
  backend?: boolean;

  /**
   * 指定的编辑器组号码（对应 workbenchEditorService 的 sortedEditorGroups 的索引）
   */
  groupIndex?: number;

  /**
   * 相对于当前活跃的 groupIndex （对应 workbenchEditorService 的 sortedEditorGroups 的索引来加减）
   */
  relativeGroupIndex?: number;

  /**
   *  强制使用这个作为tab名称， 而不遵从 resourceProvider 中提供的信息
   */
  label?: string;

  /**
   * 执行编辑器组拆分操作
   */
  split?: EditorGroupSplitAction;

  /**
   * @deprecated use focus instead
   */
  preserveFocus?: boolean;

  /**
   * 获取焦点
   */
  focus?: boolean;

  /**
   * 强制使用指定的打开方式
   */
  forceOpenType?: IEditorOpenType;

  /**
   * 不尝试在文件树上对打开的 uri 进行定位
   */
  disableNavigate?: boolean;

  /**
   * 是否使用preview模式
   * 如果是undefined，使用editor.previewMode配置作为默认值
   */
  preview?: boolean;

  /**
   * 对于DiffEditor，是否跳转到第一个diff
   */
  revealFirstDiff?: boolean;

  /**
   * 对于 deleted 的 resource 的 策略
   * 'try' : 尝试打开，在最后一个错误处爆出错误信息， 会增加tab （默认行为)
   * 'fail': 一但发现资源是deleted，直接报错，不增加tab
   * 'skip': 同 fail， 但不报错并直接跳过
   */
  deletedPolicy?: 'try' | 'fail' | 'skip';

  /**
   * 替换掉目标的 tab （通过index指定，或替换当前 tab)
   * 如果当前没有 tab，则和正常打开效果一致
   * 如果当前 tab 的关闭被阻止（比如shouldClose)，则不继续 replace 操作而是正常打开
   */
  replace?: boolean;
}

export interface IResourceOpenResult {
  groupId: string;
  [key: string]: any;
}

export interface Position {
  /**
   * Line position in a document (zero-based).
   * If a line number is greater than the number of lines in a document, it defaults back to the number of lines in the document.
   * If a line number is negative, it defaults to 0.
   */
  line: number;
  /**
   * Character offset on a line in a document (zero-based). Assuming that the line is
   * represented as a string, the `character` value represents the gap between the
   * `character` and `character + 1`.
   *
   * If the character value is greater than the line length it defaults back to the
   * line length.
   * If a line number is negative, it defaults to 0.
   */
  character: number;
}

/**
 * A single edit operation, that acts as a simple replace.
 * i.e. Replace text at `range` with `text` in model.
 */
export interface ISingleEditOperation {
  /**
   * The range to replace. This can be empty to emulate a simple insert.
   */
  range: IRange;
  /**
   * The text to replace with. This can be null to emulate a simple delete.
   */
  text: string | null;
  /**
   * This indicates that this operation has "insert" semantics.
   * i.e. forceMoveMarkers = true => if `range` is collapsed, all markers at the position will be moved.
   */
  forceMoveMarkers?: boolean;
}

/**
 * @internal
 */
export interface IThemeDecorationRenderOptions {
  backgroundColor?: string | IThemeColor;
  backgroundIcon?: string;
  backgroundIconSize?: string;

  outline?: string;
  outlineColor?: string | IThemeColor;
  outlineStyle?: string;
  outlineWidth?: string;

  border?: string;
  borderColor?: string | IThemeColor;
  borderRadius?: string;
  borderSpacing?: string;
  borderStyle?: string;
  borderWidth?: string;

  fontStyle?: string;
  fontWeight?: string;
  textDecoration?: string;
  cursor?: string;
  color?: string | IThemeColor;
  opacity?: string;
  letterSpacing?: string;

  gutterIconPath?: UriComponents | string;
  gutterIconSize?: string;

  overviewRulerColor?: string | IThemeColor;

  before?: IContentDecorationRenderOptions;
  after?: IContentDecorationRenderOptions;
}

/**
 * @internal
 */
export interface IContentDecorationRenderOptions {
  contentText?: string;
  contentIconPath?: UriComponents;

  border?: string;
  borderColor?: string | IThemeColor;
  fontStyle?: string;
  fontWeight?: string;
  textDecoration?: string;
  color?: string | IThemeColor;
  backgroundColor?: string | IThemeColor;

  margin?: string;
  width?: string;
  height?: string;
}

/**
 * @internal
 */
export interface IDecorationRenderOptions extends IThemeDecorationRenderOptions {
  isWholeLine?: boolean;
  rangeBehavior?: TrackedRangeStickiness;
  overviewRulerLane?: OverviewRulerLane;

  light?: IThemeDecorationRenderOptions;
  dark?: IThemeDecorationRenderOptions;
}

export interface UriComponents {
  scheme: string;
  authority: string;
  path: string;
  query: string;
  fragment: string;
}

export interface ITextEditorDecorationType extends IDisposable {
  key: string;
}

export const enum TrackedRangeStickiness {
  AlwaysGrowsWhenTypingAtEdges = 0,
  NeverGrowsWhenTypingAtEdges = 1,
  GrowsOnlyWhenTypingBefore = 2,
  GrowsOnlyWhenTypingAfter = 3,
}

export enum OverviewRulerLane {
  Left = 1,
  Center = 2,
  Right = 4,
  Full = 7,
}

export interface IDecorationApplyOptions {
  hoverMessage?: IHoverMessage;

  range: IRange;

  renderOptions?: IDecorationRenderOptions;
}

export type IHoverMessage = IMarkdownString | IMarkdownString[] | string;

// 定义一个resource如何被打开
export interface IEditorOpenType {
  type: 'code' | 'diff' | 'component';

  componentId?: string;

  title?: string;

  readonly?: boolean;

  // 默认0， 大的排在前面
  weight?: number;

  /**
   * 如果当前是这个打开方式，则使用这个方式的保存
   * @param resource
   */
  saveResource?(resource: IResource, reason: SaveReason);

  /**
   * 用户调用回滚文档时，如果是这个打开方式，则调用相关指令
   * @param resource
   */
  revertResource?(resource: IResource);

  undo?(resource: IResource);

  redo?(resource: IResource);
}

export enum DragOverPosition {
  LEFT = 'left',
  RIGHT = 'right',
  TOP = 'top',
  BOTTOM = 'bottom',
  CENTER = 'center',
}

export enum EditorGroupSplitAction {
  Top = 1,
  Bottom = 2,
  Left = 3,
  Right = 4,
}

export interface IEditorGroupState {
  uris: string[];

  current?: string;

  previewIndex: number;
}

export enum Direction {
  UP = 'up',
  DOWN = 'down',
  LEFT = 'left',
  RIGHT = 'right',
}

export enum SaveReason {
  Manual = 1,
  AfterDelay = 2,
  FocusOut = 3,
}

export namespace AUTO_SAVE_MODE {
  export const OFF = 'off';
  export const AFTER_DELAY = 'afterDelay';
  export const EDITOR_FOCUS_CHANGE = 'editorFocusChange';
  export const WINDOWS_LOST_FOCUS = 'windowLostFocus';
}

export interface IEditorDocumentModelContentChange {
  range: IRange;
  text: string;
  rangeLength: number;
  rangeOffset: number;
}

// 获取最基础的MonacoEditor配置
export function getSimpleEditorOptions(): IEditorOptions {
  return {
    fontSize: 12,
    fontWeight: 'normal',
    lineHeight: 0,
    wordWrap: 'on',
    overviewRulerLanes: 0,
    glyphMargin: false,
    lineNumbers: 'off',
    folding: false,
    selectOnLineNumbers: false,
    hideCursorInOverviewRuler: true,
    selectionHighlight: false,
    scrollbar: {
      horizontal: 'hidden',
    },
    lineDecorationsWidth: 0,
    overviewRulerBorder: false,
    scrollBeyondLastLine: false,
    renderLineHighlight: 'none',
    fixedOverflowWidgets: true,
    acceptSuggestionOnEnter: 'smart',
    minimap: {
      enabled: false,
    },
    guides: {
      highlightActiveIndentation: false,
      indentation: false,
      bracketPairs: false,
    },
  };
}

/**
 * A way to address editor groups through a column based system
 * where `0` is the first column. Will fallback to `SIDE_GROUP`
 * in case the column does not exist yet.
 */
export type EditorGroupColumn = number;

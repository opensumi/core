import type { editor } from '@ali/monaco-editor-core/esm/vs/editor/editor.api';
import type { ITextModelUpdateOptions } from '@ali/monaco-editor-core/esm/vs/editor/common/model';
import type { IEditorOptions } from '@ali/monaco-editor-core/esm/vs/editor/common/config/editorOptions';
import { Injectable } from '@ali/common-di';
import { URI, Event, BasicEvent, IDisposable, MaybeNull, IRange, ISelection, ILineChange, IPosition } from '@ali/ide-core-common';
import { IResource } from './resource';
import { IThemeColor } from '@ali/ide-theme/lib/common/color';
import { IEditorDocumentModel, IEditorDocumentModelRef } from '../browser';

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

  getId(): string;

  getType(): EditorType;
  /**
   * editor中打开的documentModel
   */

  currentDocumentModel: IEditorDocumentModel | null;

  currentUri: URI | null;

  getSelections(): ISelection[] | null;

  insertSnippet(template: string, ranges: readonly IRange[], opts: IUndoStopOptions);

  applyDecoration(key: string, options: IDecorationApplyOptions[]);

  onSelectionsChanged: Event<{ selections: ISelection[], source: string }>;

  onVisibleRangesChanged: Event<IRange[]>;

  onConfigurationChanged: Event<void>;

  setSelections(selection: IRange[] | ISelection[]);

  setSelection(selection: IRange | ISelection);

  updateOptions(editorOptions?: IEditorOptions, modelOptions?: ITextModelUpdateOptions);

  save(): Promise<void>;

  monacoEditor: editor.ICodeEditor;

  onDispose: Event<void>;
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

  // TODO monaco.position和lsp的是不兼容的
  onCursorPositionChanged: Event<CursorStatus>;
  onRefOpen: Event<IEditorDocumentModelRef>;
}

/**
 * Diff 编辑器抽象
 */
export interface IDiffEditor extends IDisposable {

  compare(originalDocModelRef: IEditorDocumentModelRef, modifiedDocModelRef: IEditorDocumentModelRef, options?: IResourceOpenOptions, rawUri?: URI);

  originalEditor: IEditor;

  modifiedEditor: IEditor;

  layout(): void;

  focus(): void;

  getLineChanges(): ILineChange[] | null;
}

@Injectable()
export abstract class EditorCollectionService {
  public readonly currentEditor: IEditor | undefined;
  public abstract async createCodeEditor(dom: HTMLElement, options?: any, overrides?: {[key: string]: any}): Promise<ICodeEditor>;
  public abstract async createDiffEditor(dom: HTMLElement, options?: any, overrides?: {[key: string]: any}): Promise<IDiffEditor>;
  public abstract listEditors(): IEditor[];
  public abstract listDiffEditors(): IDiffEditor[];

  public abstract onCodeEditorCreate: Event<ICodeEditor>;
  public abstract onDiffEditorCreate: Event<IDiffEditor>;
}

export type IOpenResourceResult = { group: IEditorGroup, resource: IResource } | false;
/**
 * 当前显示的Editor列表发生变化时
 */
export class CollectionEditorsUpdateEvent extends BasicEvent<IEditor[]> { }

/**
 * 当EditorGroup中打开的uri发生改变时
 */
export class DidChangeEditorGroupUriEvent extends BasicEvent<URI[][]> { }

/**
 * 当 Decoration Provider 收集完 monaco decoration option 并设置后
 */
export class DidApplyEditorDecorationFromProvider extends BasicEvent<{ key?: string; uri: URI }> {  }

export interface IEditorGroup {

  index: number;

  name: string;

  codeEditor: ICodeEditor;

  diffEditor: IDiffEditor;

  currentEditor: IEditor | null;

  /**
   * 和currentEditor不同，对于diffEditor来说会取确实在focus的Editor
   */
  currentFocusedEditor: IEditor | undefined;

  resources: IResource[];

  currentResource: MaybeNull<IResource>;

  currentOpenType: MaybeNull<IEditorOpenType>;

  onDidEditorGroupContentLoading: Event<IResource>;

  resourceStatus: Map<IResource, Promise<void>>;

  open(uri: URI, options?: IResourceOpenOptions): Promise<IOpenResourceResult>;

  pin(uri: URI): Promise<void>;

  close(uri: URI): Promise<void>;

  getState(): IEditorGroupState;

  restoreState(IEditorGroupState): Promise<void>;

  saveAll(): Promise<void>;

  closeAll(): Promise<void>;

  /**
   * 保存当前
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

  onActiveResourceChange: Event<MaybeNull<IResource>>;

  onCursorChange: Event<CursorStatus>;

  /**
   * 编辑器组发生改变时的事件
   */
  onDidEditorGroupsChanged: Event<void>;

  /**
   * 当前 editorGroup 发生改变的事件
   */
  onDidCurrentEditorGroupChanged: Event<IEditorGroup>;

  // TODO
  editorGroups: IEditorGroup[];

  sortedEditorGroups: IEditorGroup[];

  currentEditor: IEditor | null;

  currentResource: MaybeNull<IResource>;

  currentEditorGroup: IEditorGroup;

  abstract async closeAll(uri?: URI, force?: boolean): Promise<void>;

  abstract async open(uri: URI, options?: IResourceOpenOptions): Promise<IOpenResourceResult>;
  abstract async openUris(uri: URI[]): Promise<void>;

  abstract saveAll(includeUntitled?: boolean): Promise<void>;

  abstract async close(uri: any, force?: boolean): Promise<void>;

  abstract getAllOpenedUris(): URI[];

  // 创建一个带待存的资源
  abstract createUntitledResource(options?: IUntitledOptions): Promise<IOpenResourceResult>;
}

export interface IUntitledOptions extends IResourceOpenOptions {
  uri: URI;
  resourceOpenOptions?: IResourceOpenOptions;
}

export interface IResourceOpenOptions {

  range?: Partial<IRange>;

  // 如果打开的是 diff 编辑器，可以指定 original editor 的 range
  originalRange?: Partial<IRange>;

  index?: number;

  backend?: boolean;

  groupIndex?: number;

  // 相对于当前活跃的 groupIndex
  relativeGroupIndex?: number;

  // 强制使用这个作为tab名称
  label?: string;

  split?: EditorGroupSplitAction;

  /**
   * @deprecated use focus instead
   */
  preserveFocus?: boolean;

  /**
   * 获取焦点
   */
  focus?: boolean;

  forceOpenType?: IEditorOpenType;

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
 * End of line character preference.
 */
export const enum EndOfLineSequence {
  /**
   * Use line feed (\n) as the end of line character.
   */
  LF = 0,
  /**
   * Use carriage return and line feed (\r\n) as the end of line character.
   */
  CRLF = 1,
}

/**
 * End of line character preference.
 */
export const enum EOL {

  LF = '\n',

  CRLF = '\r\n',
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
export interface IMarkdownString {
  value: string;
  isTrusted?: boolean;
  uris?: {
    [href: string]: UriComponents;
  };
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
  CENTER= 'center',
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
  };
}

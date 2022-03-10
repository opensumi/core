import {
  IRange,
  URI,
  IDisposable,
  MaybePromise,
  TreeNode,
  Event,
  BasicEvent,
  positionToRange,
  IContextKeyService,
} from '@opensumi/ide-core-browser';
import { RecycleTreeProps } from '@opensumi/ide-core-browser/lib/components';
import { IEditor } from '@opensumi/ide-editor';
// eslint-disable-next-line import/no-restricted-paths
import type { IEditorDocumentModel } from '@opensumi/ide-editor/lib/browser';

type Writeable<T> = { -readonly [P in keyof T]: T[P] };

/**
 * @deprecated please use `positionToRange` from '@opensumi/ide-core-common`
 */
export const toRange = positionToRange;

/**
 * 点击评论菜单贡献点默认加入当前 menuId 作为标识
 */
interface ICommentsMenuContext {
  /**
   * 注册在 menu 的 id
   */
  menuId: string;
}

/**
 * 评论树的节点
 */
export interface ICommentsTreeNode extends Writeable<TreeNode<ICommentsTreeNode>> {
  /**
   * 子节点
   */
  children?: ICommentsTreeNode[];
  /**
   * 是否折叠
   */
  expanded?: boolean;
  /**
   * 子节点对应的 thread
   */
  thread: ICommentsThread;
  /**
   * 子节点对应的 comment
   * 如果是根节点则为 undefined
   */
  comment?: IComment;
  /**
   * 点击事件
   */
  onSelect?: (node: ICommentsTreeNode) => void;
}

/**
 * 评论模式
 */
export enum CommentMode {
  /**
   * 编辑状态
   */
  Editor = 0,
  /**
   * 预览状态
   */
  Preview = 1,
}

/**
 * thread 展开模式
 */
export enum CommentThreadCollapsibleState {
  /**
   * 收起状态
   */
  Collapsed = 0,
  /**
   * 展开状态
   */
  Expanded = 1,
}

/**
 * editor gutter 的类型
 */
export enum CommentGutterType {
  /**
   * 含有 thread 的 gutter，有黑点
   */
  Thread = 'thread',
  /**
   * 不含 thread 的 gutter，无黑点
   */
  Empty = 'empty',
}

export const CommentPanelId = 'CommentPanel';

/**
 * 获取评论里的回复
 */
export interface ICommentReply extends ICommentsMenuContext {
  /**
   * 当前 thread
   */
  thread: ICommentsThread;
  /**
   * 回复里的内容
   */
  text: string;
  /**
   * 当前 widget
   */
  widget: ICommentsZoneWidget;
}

export interface ICommentsZoneWidget {
  /**
   * widget 所在的 editor
   */
  coreEditor: IEditor;
  /**
   * 是否在展示
   */
  isShow: boolean;
  /**
   * 切换显隐
   */
  toggle(): void;
  /**
   * 设置为显示
   */
  show(): void;
  /**
   * 设置为隐藏
   */
  hide(): void;
  /**
   * 销毁
   */
  dispose(): void;
  /**
   * 重新设置 widget
   * 会先 remove zone 再 append
   */
  resize(): void;
  /**
   * monaco 默认正只能写死 zone widget height，若要随着 view 变化进行高度的变化则需要删除重建
   * 如果有此类操作则会触发该事件
   */
  onChangeZoneWidget: Event<IRange>;
  /*
    widget 展示的时候触发
   */
  onShow: Event<void>;
  /**
   * widget 隐藏的时候触发
   */
  onHide: Event<void>;
  /**
   * zone wiget 第一次显示的时候执行
   */
  onFirstDisplay: Event<number>;
}

export interface ICommentThreadTitle extends ICommentsMenuContext {
  /**
   * 当前 thread
   */
  thread: ICommentsThread;
  /**
   * 当前 widget
   */
  widget: ICommentsZoneWidget;
}

export interface ICommentAuthorInformation {
  name: string;
  iconPath?: URI | string;
}

/**
 * 评论 Reaction
 */
export interface CommentReaction {
  /**
   * 用于 title 提示
   */
  readonly label: string | undefined;

  /**
   * 显示的图标
   */
  readonly iconPath: string | URI;

  /**
   * 和当前 reaction 相关的用户数量
   */
  readonly count: number;

  /**
   * 点击此 reaction 是否需要反馈
   */
  readonly authorHasReacted: boolean;
}

export interface ICommentsCommentTitle extends ICommentsMenuContext {
  /**
   * 当前 thread
   */
  thread: ICommentsThread;
  /**
   * 当前评论
   */
  comment: IComment;
}

export interface ICommentsCommentContext extends ICommentsCommentTitle {
  body: string;
}

/**
 * 评论
 */
export interface IComment {
  /**
   * 评论类型
   */
  mode?: CommentMode;
  /**
   * 评论内容
   */
  body: string;
  /**
   * 作者信息
   */
  author: ICommentAuthorInformation;
  /**
   * 附属显示
   */
  label?: string | React.ReactNode;
  /**
   * 添加附属数据
   */
  data?: any;
  /**
   * comment 的 context, key 为 comment
   * 比如只想在某些 comment 贡献菜单，可以在 when 里写 comment == aaa
   * 其中 aaa 就是 contextValue 的值
   */
  contextValue?: string;
  /**
   * 评论 reaction
   */
  reactions?: CommentReaction[];
}

/**
 * 给渲染层使用的评论
 */
export interface IThreadComment extends IComment {
  /**
   * 添加一个评论会生成一个 id
   */
  id: string;
}

export interface CommentsPanelOptions {
  /**
   * panel icon class name
   */
  iconClass?: string;
  priority?: number;
  /**
   * panel title
   */
  title?: string;
  /**
   * is hidden
   */
  hidden?: boolean;
  badge?: string;
  /**
   * title component
   */
  titleComponent?: React.ComponentType<any>;
  initialProps?: object;
  /**
   * header component
   */
  header?: {
    component: React.ReactNode;
    height: number;
  };
  /**
   * 无内容显示的文案
   */
  defaultPlaceholder?: React.ReactNode | string;
  /**
   * 是否默认显示 底部 panel
   */
  defaultShow?: boolean;
  /**
   * 评论列表默认设置
   */
  recycleTreeProps?: Partial<RecycleTreeProps>;
}

export type PanelTreeNodeHandler = (nodes: ICommentsTreeNode[]) => ICommentsTreeNode[];

export type FileUploadHandler = (text: string, files: FileList) => MaybePromise<string>;

export type ZoneWidgerRender = (thread: ICommentsThread, widget: ICommentsZoneWidget) => React.ReactNode;

export interface MentionsData {
  id: string;
  display: string;
  [key: string]: any;
}

export interface MentionsOptions {
  /**
   * 最终选择后在输入框里显示的样子
   * 默认为 @${display}
   */
  displayTransform?: (id: string, display: string) => string;
  /**
   * 在搜索时返回数据
   */
  providerData?: (query: string) => MaybePromise<MentionsData[]>;
  /**
   * 渲染每一个搜索选项的函数
   * 默认为 <div>${display}</div>
   */
  renderSuggestion?: (data: MentionsData, search: string, highlightedDisplay: string) => React.ReactNode;
  /**
   * 用于预览时的模板
   * 默认为 '@[__display__](__id__)'
   */
  markup?: string;
}

export interface ICommentProviderFeature {
  /**
   * 设置在评论区输入框的配置
   */
  placeholder?: string;
}

export interface ICommentsConfig {
  /**
   * 是否支持单行多个评论
   * 默认为 false
   */
  isMultiCommentsForSingleLine?: boolean;
  /**
   * 当前用户信息，用于第一次创建时面板左侧的显示的用户头像
   */
  author?: {
    avatar: string;
  };
  /**
   * 设置在编辑器里是否展示特定评论的过滤函数
   */
  filterThreadDecoration?: (thread: ICommentsThread) => boolean;
}

export const ICommentsFeatureRegistry = Symbol('ICommentsFeatureRegistry');
export interface ICommentsFeatureRegistry {
  /**
   * 注册基础信息
   */
  registerConfig(config: ICommentsConfig): void;
  /**
   * 注册在评论面板里文件上传的处理函数
   * @param handler
   */
  registerFileUploadHandler(handler: FileUploadHandler): void;
  /**
   * 注册底部面板的参数，可以覆盖底部面板的默认参数
   * @param options
   */
  registerPanelOptions(options: CommentsPanelOptions): void;
  /**
   * 注册底部面板评论树的处理函数，可以在渲染前重新再定义一次树的数据结构
   * @param handler
   */
  registerPanelTreeNodeHandler(handler: PanelTreeNodeHandler): void;
  /**
   * 注册提及相关功能的能力
   * @param options
   */
  registerMentionsOptions(options: MentionsOptions): void;

  /**
   * 注册 WidgetView
   * @param render
   */
  registerZoneWidgetRender(render: ZoneWidgerRender): void;

  /**
   * 注册 Provider Feature
   * @param provider id
   * @param feature
   */
  registerProviderFeature(providerId: string, feature: ICommentProviderFeature): void;

  /**
   * 获取底部面板参数
   */
  getCommentsPanelOptions(): CommentsPanelOptions;
  /**
   * 获取底部面板评论树的处理函数
   */
  getCommentsPanelTreeNodeHandlers(): PanelTreeNodeHandler[];
  /**
   * 获取文件上传处理函数
   */
  getFileUploadHandler(): FileUploadHandler | undefined;
  /**
   * 获取提及相关参数
   */
  getMentionsOptions(): MentionsOptions;

  /**
   * 获取指定的 zone widget
   */
  getZoneWidgetRender(): ZoneWidgerRender | undefined;
  /**
   * 获取基础配置
   */
  getConfig(): ICommentsConfig;

  /**
   * 获取 provider feature
   * */
  getProviderFeature(providerId: string): ICommentProviderFeature | undefined;
}

export const CommentsContribution = Symbol('CommentsContribution');
export interface CommentsContribution {
  /**
   * 提供可评论的 range
   * @param editor 当前 editor 实例
   */
  provideCommentingRanges(documentModel: IEditorDocumentModel): MaybePromise<IRange[] | undefined>;
  /**
   * 扩展评论模块的能力
   * @param registry
   */
  registerCommentsFeature?(registry: ICommentsFeatureRegistry): void;
}

/**
 * 创建 comment thread
 */
export interface ICommentsThread extends IDisposable {
  /**
   * thread id
   */
  id: string;
  /**
   * provider id
   */
  providerId: string;
  /**
   * 评论
   */
  comments: IThreadComment[];
  /**
   * 当前 thread 的 uri
   */
  uri: URI;
  /**
   * 当前 thread range
   */
  range: IRange;
  /**
   * 是否折叠，默认为 false
   */
  isCollapsed: boolean;
  /**
   * 附属数据
   */
  data?: any;
  /**
   * thread 维度的 contextValue
   */
  contextValue?: string;
  /**
   * 在 header 组件显示的文案
   */
  label?: string;
  /**
   * thread 参数
   */
  options: ICommentsThreadOptions;
  /**
   * thread 头部文案
   */
  threadHeaderTitle: string;
  /**
   * 是否是只读
   */
  readOnly: boolean;
  /**
   * 评论面板的 context key service
   */
  contextKeyService: IContextKeyService;
  /**
   * 添加评论
   * @param comment
   */
  addComment(...comment: IComment[]): void;
  /**
   * 移除评论
   * @param comment
   */
  removeComment(comment: IComment): void;
  /**
   * 显示 zone widget
   * @param editor 指定在某一个 editor 中打开
   */
  show(editor?: IEditor): void;
  /**
   * 如果之前是显示的状态，则恢复显示
   */
  showWidgetsIfShowed(): void;
  /**
   * 临时隐藏 wiget，restoreShow 时恢复
   */
  hideWidgetsByDispose(): void;
  /**
   * 切换 zone widget
   */
  toggle(editor: IEditor): void;
  /**
   * 隐藏 zone widget
   * @param editor 指定在某一个 editor 中隐藏
   */
  hide(editor?: IEditor): void;
  /**
   * 显示所有 zone widget
   * @deprecated
   */
  showAll(): void;
  /**
   * 隐藏所有 widget
   * @deprecated
   * @param isDispose dispose widget，此时不修改内部 _isShow 变量
   */
  hideAll(isDispose?: boolean): void;
  /**
   * 判断当前 editor 是否有显示的 widget
   * @param editor
   */
  isShowWidget(editor?: IEditor): boolean;
  /**
   * 判断是否是统一 uri，同一 range 的 thread
   * @param thread
   */
  isEqual(thread: ICommentsThread): boolean;
  /**
   * 通过 editor 获取 zone widget
   * @param editor
   */
  getWidgetByEditor(editor: IEditor): ICommentsZoneWidget | undefined;
  /**
   * dispise 时会执行
   */
  onDispose: Event<void>;
}

export interface ICommentsThreadOptions {
  comments?: IComment[];
  /**
   * 在 header 上定义的文案
   */
  label?: string;
  /**
   * 是否是只读模式
   */
  readOnly?: boolean;
  /**
   * 初始化折叠状态，默认为展开
   */
  isCollapsed?: boolean;
  /**
   * thread container className
   */
  threadClassName?: string;
  /**
   * thread title className
   */
  threadHeadClassName?: string;
  /**
   * 附属数据
   */
  data?: any;
  /**
   * thread context value
   */
  contextValue?: string;
}

export const ICommentsService = Symbol('ICommentsService');
export interface ICommentsService {
  /**
   * 评论节点
   */
  commentsThreads: ICommentsThread[];
  /**
   * 评论树节点
   */
  commentsTreeNodes: ICommentsTreeNode[];
  /**
   * 初始化函数
   */
  init(): void;
  /**
   * 编辑器创建后的处理函数
   * @param editor 当前编辑器
   */
  handleOnCreateEditor(editor: IEditor): IDisposable;
  /**
   * 创建一个 thread
   * @param uri 执行 uri，支持 file 和 git 协议
   * @param range 创建 thread 的行数
   * @param options 额外参数
   */
  createThread(uri: URI, range: IRange, options?: ICommentsThreadOptions): ICommentsThread;
  /**
   * 获取指定 uri 下所有的 threads
   * 默认按照 range 升序排列
   * @param uri
   */
  getThreadsByUri(uri: URI): ICommentsThread[];
  /**
   * threads 变化的事件
   */
  onThreadsChanged: Event<ICommentsThread>;
  /**
   * threads 创建的事件
   */
  onThreadsCreated: Event<ICommentsThread>;
  /**
   * 强制更新 tree node，再走一次 TreeNodeHandler 逻辑
   */
  forceUpdateTreeNodes(): void;
  /**
   * 触发 左侧 decoration 的渲染
   */
  forceUpdateDecoration(): void;
  /**
   * 注册插件底部面板
   */
  registerCommentPanel(): void;
  /**
   * 外部注册可评论的行号提供者
   */
  registerCommentRangeProvider(id: string, provider: ICommentRangeProvider): IDisposable;
  /**
   * 获取当前行的 provider id
   * @param line
   */
  getProviderIdsByLine(line: number): string[];
  /**
   * 获取指定 uri 可以评论的 range
   * @param uri
   */
  getContributionRanges(uri: URI): Promise<IRange[]>;
  /**
   * 销毁所有的 thread
   */
  dispose(): void;
}

export const CollapseId = 'comments.panel.action.collapse';

export const CloseThreadId = 'comments.thread.action.close';

export const SwitchCommandReaction = 'comments.comment.action.switchCommand';

export class CommentPanelCollapse extends BasicEvent<void> {}

export interface ICommentRangeProvider {
  getCommentingRanges(documentModel: IEditorDocumentModel): MaybePromise<IRange[] | undefined>;
}

export interface CommentReactionPayload {
  thread: ICommentsThread;
  comment: IThreadComment;
  reaction: CommentReaction;
}

export class CommentReactionClick extends BasicEvent<CommentReactionPayload> {}

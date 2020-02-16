import { IEditor } from '@ali/ide-editor';
import {
  IRange,
  URI,
  IDisposable,
  MaybePromise,
  TreeNode,
  Event,
  BasicEvent,
} from '@ali/ide-core-common';

type Writeable<T> = { -readonly [P in keyof T]: T[P] };

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
export interface ICommentReply {
  /**
   * 当前 thread
   */
  thread: ICommentsThread;
  /**
   * 回复里的内容
   */
  text: string;
}

export interface ICommentAuthorInformation {
  name: string;
  iconPath?: URI | string;
}

/**
 * 评论
 */
export interface IComment {
  /**
   * 评论类型
   */
  mode: CommentMode;
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
  iconClass?: string;
  priority?: number;
  title?: string;
  hidden?: boolean;
  badge?: string;
  titleComponent?: React.FunctionComponent;
}

export type PanelTreeNodeHandler = (nodes: ICommentsTreeNode[]) => ICommentsTreeNode[];

export const ICommentsFeatureRegistry = Symbol('ICommentsFeatureRegistry');
export interface ICommentsFeatureRegistry {
  registerPanelOptions(options: CommentsPanelOptions): void;
  registerPanelTreeNodeHandler(handler: PanelTreeNodeHandler): void;
  getCommentsPanelOptions(): CommentsPanelOptions;
  getCommentsPanelTreeNodeHandlers(): PanelTreeNodeHandler[];
}

export const CommentsContribution = Symbol('CommentsContribution');
export interface CommentsContribution {
  /**
   * 提供可评论的 range
   * @param editor 当前 editor 实例
   */
  provideCommentingRanges(editor: IEditor): MaybePromise<IRange[] | undefined>;
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
   * id 为 uri#range
   */
  id: string;
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
   * 附属数据
   */
  data?: any;
  /**
   * 添加一条评论
   * @param comment
   */
  addComment(...comment: IComment[]): void;
  /**
   * 显示 zone widget
   */
  show(): void;
  /**
   * 切换 zone widget
   */
  toggle(editor: IEditor): void;
  /**
   * 隐藏 zone widget
   */
  hide(): void;
}

export interface ICommentsThreadOptions {
  comments?: IComment[];
  /**
   * 是否是只读模式
   */
  readOnly?: boolean;
  /**
   * 初始化折叠状态，默认为展开
   */
  isCollapsed?: boolean;
  /**
   * 附属数据
   */
  data?: any;
}

export const ICommentsService = Symbol('ICommentsService');
export interface ICommentsService {
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
   * threads 变化的事件
   */
  onThreadsChanged: Event<void>;
}

/**
 * position 转换 range
 * @param position
 */
export function toRange(position: monaco.IPosition | number): monaco.IRange {
  if (typeof position === 'number') {
    return {
      startLineNumber: position,
      endLineNumber: position,
      startColumn: 1,
      endColumn: 1,
    };
  } else {
    const { lineNumber } = position;
    return {
      startLineNumber: lineNumber,
      endLineNumber: lineNumber,
      startColumn: 1,
      endColumn: 1,
    };
  }
}

export const CollapseId = 'comments.panel.action.collapse';

export class CommentPanelCollapse extends BasicEvent<void> {}

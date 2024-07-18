import { CancellationToken, MaybePromise, Uri } from '@opensumi/ide-utils';
import { SumiReadableStream } from '@opensumi/ide-utils/lib/stream';

import { FileType } from '../file';
import { IMarkdownString } from '../markdown';

import { IAIReportCompletionOption } from './reporter';
export * from './reporter';

export interface IAINativeCapabilities {
  /**
   * Problem panel uses ai capabilities
   */
  supportsMarkers?: boolean;
  /**
   * Use ai chat capabilities
   */
  supportsChatAssistant?: boolean;
  /**
   * Use inline chat capabilities
   */
  supportsInlineChat?: boolean;
  /**
   * Use code intelligent completion capabilities
   */
  supportsInlineCompletion?: boolean;
  /**
   * Use ai to intelligently resolve conflicts
   */
  supportsConflictResolve?: boolean;
  /**
   * Use ai to provide rename suggestions
   */
  supportsRenameSuggestions?: boolean;
  /**
   * Use ai terminal detection capabilities
   */
  supportsTerminalDetection?: boolean;
  /**
   * Use ai terminal command suggets capabilities
   */
  supportsTerminalCommandSuggest?: boolean;
}

export interface IDesignLayoutConfig {
  /**
   * merge right panel with left panel
   */
  useMergeRightWithLeftPanel?: boolean;
  /**
   * use new manubar view
   * @deprecated Please use layoutConfig
   */
  useMenubarView?: boolean;
  /**
   * set menubar logo
   */
  menubarLogo?: string;
}

export interface IAINativeConfig {
  capabilities?: IAINativeCapabilities;
  layout?: IDesignLayoutConfig;
}

export enum ECompletionType {
  /**
   * 行补全
   */
  Line = 0,
  /**
   * 片段补全
   */
  Snippet = 1,
  /**
   * 块补全
   */
  Block = 2,
}

/**
 * 补全模型
 */
export interface CodeModel {
  content: string;
  displayName?: string;
  id?: number;
  score?: number;
  /**
   * 补全来源，当你的后端对接了多个 LLM 时，可以通过 source 来区分不同的模型
   */
  source?: string;
  completionType?: ECompletionType;
}

export interface IAICompletionResultModel {
  sessionId: string;
  codeModelList: Array<CodeModel>;
  isCancel?: boolean;
}

export const AIBackSerivceToken = Symbol('AIBackSerivceToken');
export const AIBackSerivcePath = 'AIBackSerivcePath';

export interface IAIBackServiceResponse<T = string> {
  errorCode?: number;
  errorMsg?: string;
  isCancel?: boolean;
  data?: T;
}

export interface IAIBackServiceOption {
  type?: string;
  requestId?: string;
  history?: IHistoryChatMessage[];
}

/**
 * 补全请求对象
 */
export interface IAICompletionOption {
  sessionId: string;
  /**
   * 模型输入上文
   */
  prompt: string;
  /**
   * 代码下文
   */
  suffix?: string | null;

  workspaceDir: string;
  /**
   * 文件路径
   */
  fileUrl: string;
  /**
   * 代码语言类型
   */
  language: string;
}

export interface IAIRenameSuggestionOption {
  prompt: string;
  language?: string;
}

export interface IAIBackService<
  BaseResponse extends IAIBackServiceResponse = IAIBackServiceResponse,
  StreamResponse extends SumiReadableStream<IChatProgress> = SumiReadableStream<IChatProgress>,
  CompletionResponse = IAICompletionResultModel,
> {
  request<O extends IAIBackServiceOption>(
    input: string,
    options: O,
    cancelToken?: CancellationToken,
  ): Promise<BaseResponse>;
  requestStream<O extends IAIBackServiceOption>(
    input: string,
    options: O,
    cancelToken?: CancellationToken,
  ): Promise<StreamResponse>;
  requestCompletion?<I extends IAICompletionOption>(
    input: I,
    cancelToken?: CancellationToken,
  ): Promise<CompletionResponse>;
  reportCompletion?<I extends IAIReportCompletionOption>(input: I): Promise<void>;
}

export class ReplyResponse {
  public get message(): string {
    return this._message;
  }

  constructor(private _message: string) {}

  static is(response: any): boolean {
    return response instanceof ReplyResponse || (typeof response === 'object' && response.message !== undefined);
  }

  extractCodeContent(): string {
    const regex = /```\w*([\s\S]+?)\s*```/;
    const match = regex.exec(this.message);
    return match ? match[1].trim() : this.message.trim();
  }

  updateMessage(msg: string): void {
    this._message = msg;
  }
}

export class ErrorResponse {
  constructor(readonly error: any, readonly message?: string) {}

  static is(response: any): boolean {
    return response instanceof ErrorResponse || (typeof response === 'object' && response.error !== undefined);
  }
}

export class CancelResponse {
  readonly cancellation: boolean = true;

  constructor(readonly message?: string) {}

  static is(response: any): boolean {
    return response instanceof CancelResponse || (typeof response === 'object' && response.cancellation !== undefined);
  }
}

export type ChatResponse = ReplyResponse | ErrorResponse | CancelResponse;

/**
 * DI Token
 */
export const InlineChatFeatureRegistryToken = Symbol('InlineChatFeatureRegistryToken');
export const ChatFeatureRegistryToken = Symbol('ChatFeatureRegistryToken');
export const ChatRenderRegistryToken = Symbol('ChatRenderRegistryToken');
export const ResolveConflictRegistryToken = Symbol('ResolveConflictRegistryToken');
export const RenameCandidatesProviderRegistryToken = Symbol('RenameCandidatesProviderRegistryToken');
export const TerminalRegistryToken = Symbol('TerminalRegistryToken');
export const IntelligentCompletionsRegistryToken = Symbol('IntelligentCompletionsRegistryToken');

export const ChatServiceToken = Symbol('ChatServiceToken');
export const ChatAgentViewServiceToken = Symbol('ChatAgentViewServiceToken');

/**
 * Contribute Registry
 */
export interface IConflictContentMetadata {
  /**
   * @threeWay 当前分支的代码
   * @transitional 当前分支的代码
   */
  current: string;

  /**
   * @threeWay 基础分支的代码
   * @transitional 无
   */
  base: string;
  /**
   * @threeWay 远程分支的代码
   * @transitional 远程分支的代码
   */
  incoming: string;

  currentName?: string;
  baseName?: string;
  incomingName?: string;

  /**
   * 如果是用户要求 regenerate 的话，这个字段代表上一次 AI 生成的结果
   */
  resultContent?: string;
}
export interface IResolveConflictHandler {
  providerRequest: (
    contentMetadata: IConflictContentMetadata,
    options: { isRegenerate: boolean },
    token: CancellationToken,
  ) => MaybePromise<ChatResponse>;
}
export interface IInternalResolveConflictRegistry {
  getThreeWayHandler(): IResolveConflictHandler | undefined;
  getTraditionalHandler(): IResolveConflictHandler | undefined;
}
export interface IChatContent {
  content: string;
  kind: 'content';
}

export interface IChatMarkdownContent {
  content: IMarkdownString;
  kind: 'markdownContent';
}

export interface IChatAsyncContent {
  content: string;
  resolvedContent: Promise<string | IMarkdownString | IChatTreeData>;
  kind: 'asyncContent';
}

export interface IChatProgressMessage {
  content: string;
  kind: 'progressMessage';
}

export interface IChatResponseProgressFileTreeData {
  label: string;
  uri: Uri;
  type?: FileType;
  children?: IChatResponseProgressFileTreeData[];
}

export interface IChatTreeData {
  treeData: IChatResponseProgressFileTreeData;
  kind: 'treeData';
}

export interface IChatComponent {
  component: string;
  value?: unknown;
  kind: 'component';
}

export type IChatProgress = IChatContent | IChatMarkdownContent | IChatAsyncContent | IChatTreeData | IChatComponent;

export interface IChatMessage {
  readonly role: ChatMessageRole;
  readonly content: string;
  readonly name?: string;
}

export const enum ChatMessageRole {
  System,
  User,
  Assistant,
  Function,
}

export interface IHistoryChatMessage extends IChatMessage {
  id: string;
  order: number;

  type?: 'string' | 'component';
  relationId?: string;
  component?: React.ReactNode;
  componentProps?: {
    [key in string]: any;
  };

  agentId?: string;
  agentCommand?: string;
}

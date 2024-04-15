import { CancellationToken, MaybePromise } from '../../utils';

import { IAIReportCompletionOption } from './reporter';
export * from './reporter';

export interface IAINativeCapabilities {
  /**
   * Use opensumi design UI style
   */
  supportsOpenSumiDesign?: boolean;
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

export interface IAINativeLayout {
  // Use Merge right panel with left panel
  useMergeRightWithLeftPanel?: boolean;
  // Use ai manubar view
  useMenubarView?: boolean;
  // set menubar logo
  menubarLogo?: string;
}

export interface IAINativeConfig {
  capabilities?: IAINativeCapabilities;
  layout?: IAINativeLayout;
}

export interface IAICompletionResultModel {
  sessionId: string;
  codeModelList: Array<{ content: string }>;
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
  model?: string;
  enableGptCache?: boolean;
  sessionId?: string;
}

export interface IAICompletionOption {
  prompt: string;
  suffix?: string;
  language?: string;
  fileUrl?: string;
  sessionId?: string;
}

export interface IAIRenameSuggestionOption {
  prompt: string;
  language?: string;
}

export interface IAIBackService<
  BaseResponse extends IAIBackServiceResponse = IAIBackServiceResponse,
  StreamResponse extends NodeJS.ReadableStream = NodeJS.ReadableStream,
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
  requestCompletion<I extends IAICompletionOption>(
    input: I,
    cancelToken?: CancellationToken,
  ): Promise<CompletionResponse>;
  reportCompletion<I extends IAIReportCompletionOption>(input: I): Promise<void>;
  destroyStreamRequest?: (sessionId: string) => Promise<void>;
}

export class ReplyResponse {
  constructor(readonly message: string) {}

  static is(response: any): boolean {
    return response instanceof ReplyResponse || (typeof response === 'object' && response.message !== undefined);
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

export const ChatServiceToken = Symbol('ChatServiceToken');
export const ChatAgentViewServiceToken = Symbol('ChatAgentViewServiceToken');

/**
 * Contribute Registry
 */
export interface IConflictContentMetadata {
  current: string;
  base: string;
  incoming: string;

  // 各分支的名称
  currentName?: string;
  baseName?: string;
  incomingName?: string;

  resultContent?: string;
}
export interface IResolveConflictHandler {
  providerRequest: (
    contentMetadata: IConflictContentMetadata,
    options: { isRegenerate: boolean },
    token: CancellationToken,
  ) => MaybePromise<ReplyResponse | ErrorResponse | CancelResponse>;
}
export interface IInternalResolveConflictRegistry {
  getThreeWayHandler(): IResolveConflictHandler | undefined;
  getTraditionalHandler(): IResolveConflictHandler | undefined;
}

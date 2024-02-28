import { CancellationToken } from '../utils';

export interface IAiNativeCapabilities {
  /**
   * Use opensumi design UI style
   */
  supportsOpenSumiDesign?: boolean;
  /**
   * Problem panel uses ai capabilities
   */
  supportsAiMarkers?: boolean;
  /**
   * Use ai chat capabilities
   */
  supportsAiChatAssistant?: boolean;
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
}

export interface IAiNativeConfig {
  capabilities?: IAiNativeCapabilities;
}

export interface IAiCompletionResultModel {
  sessionId: string;
  codeModelList: Array<{ content: string }>;
  isCancel?: boolean;
}

export const AiBackSerivceToken = Symbol('AiBackSerivceToken');
export const AiBackSerivcePath = 'AiBackSerivcePath';

export interface IAiBackServiceResponse<T = string> {
  errorCode?: number;
  errorMsg?: string;
  isCancel?: boolean;
  data?: T;
}

export interface IAiBackServiceOption {
  type?: string;
  model?: string;
  enableGptCache?: boolean;
}

export interface IAiCompletionOption {
  prompt: string;
  suffix?: string;
  language?: string;
  fileUrl?: string;
  sessionId?: string;
}

export interface IAiReportCompletionOption {
  relationId: string;
  sessionId: string;
  accept: boolean;
  repo?: string;
  completionUseTime?: number;
  renderingTime?: number;
}

export interface IAiBackService<
  BaseResponse extends IAiBackServiceResponse = IAiBackServiceResponse,
  StreamResponse extends NodeJS.ReadableStream = NodeJS.ReadableStream,
  CompletionResponse = IAiCompletionResultModel,
> {
  request<O extends IAiBackServiceOption>(
    input: string,
    options: O,
    cancelToken?: CancellationToken,
  ): Promise<BaseResponse>;
  requestStream<O extends IAiBackServiceOption>(
    input: string,
    options: O,
    cancelToken?: CancellationToken,
  ): Promise<StreamResponse>;
  requestCompletion<I extends IAiCompletionOption>(
    input: I,
    cancelToken?: CancellationToken,
  ): Promise<CompletionResponse>;
  reportCompletion<I extends IAiReportCompletionOption>(input: I): Promise<void>;
  destroyStreamRequest?: (sessionId: string) => Promise<void>;
}

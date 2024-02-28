import { CancellationToken } from '../utils';

export interface IAiNativeCapabilities {
  /**
   * 使用 opensumi design UI 风格
   */
  supportsOpenSumiDesign?: boolean;
  /**
   * 问题面板使用 ai 能力
   */
  supportsAiMarkers?: boolean;
  /**
   * 使用 ai chat 能力
   */
  supportsAiChatAssistant?: boolean;
  /**
   * 使用 inline chat 能力
   */
  supportsInlineChat?: boolean;
  /**
   * 使用代码智能补全能力
   */
  supportsInlineCompletion?: boolean;
  /**
   * 使用 ai 智能解决冲突的能力
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

import { CancellationToken } from '../utils';

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
}

export interface IAINativeConfig {
  capabilities?: IAINativeCapabilities;
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
}

export interface IAICompletionOption {
  prompt: string;
  suffix?: string;
  language?: string;
  fileUrl?: string;
  sessionId?: string;
}

export interface IAIReportCompletionOption {
  relationId: string;
  sessionId: string;
  accept: boolean;
  repo?: string;
  completionUseTime?: number;
  renderingTime?: number;
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

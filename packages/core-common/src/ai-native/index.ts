import { CancellationToken } from '../utils';

/**
 * 补全返回结果对象
 */
export interface CompletionResultModel {
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
  CompletionResponse = CompletionResultModel,
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

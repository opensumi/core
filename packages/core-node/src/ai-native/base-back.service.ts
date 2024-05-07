import { Readable } from 'stream';

import { Injectable } from '@opensumi/di';
import { RPCService } from '@opensumi/ide-connection';
import {
  CancellationToken,
  IAIBackService,
  IAIBackServiceOption,
  IAIBackServiceResponse,
  IAICompletionOption,
  IAICompletionResultModel,
  IAIReportCompletionOption,
  IChatProgress,
} from '@opensumi/ide-core-common';
import { SumiReadableStream } from '@opensumi/ide-utils/lib/stream';

export class ChatReadableStream extends SumiReadableStream<IChatProgress> {}

@Injectable()
export class BaseAIBackService implements IAIBackService<IAIBackServiceResponse, Readable> {
  async request<T = IAIBackServiceResponse<string>>(
    input: string,
    options: IAIBackServiceOption,
    cancelToken?: CancellationToken,
  ): Promise<T> {
    return void 0 as T;
  }

  async requestStream<T = IAIBackServiceResponse<string>>(
    input: string,
    options: IAIBackServiceOption,
    cancelToken?: CancellationToken,
  ): Promise<T> {
    return void 0 as T;
  }

  async requestCompletion<T = IAICompletionResultModel>(input: IAICompletionOption, cancelToken?: CancellationToken) {
    return void 0 as T;
  }

  async reportCompletion<T = IAIReportCompletionOption>(input: IAIReportCompletionOption) {}

  async destroyStreamRequest(sessionId: string) {}
}

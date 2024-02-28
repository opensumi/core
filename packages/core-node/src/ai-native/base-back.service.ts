import { Readable } from 'stream';

import { Injectable } from '@opensumi/di';
import { RPCService } from '@opensumi/ide-connection';
import {
  CancellationToken,
  IAiBackService,
  IAiBackServiceOption,
  IAiBackServiceResponse,
  IAiCompletionOption,
  IAiCompletionResultModel,
  IAiReportCompletionOption,
} from '@opensumi/ide-core-common';

interface IRPCGptService {
  onMessage(msg: string, sessionId?: string): void;
}

@Injectable()
export class BaseAiBackService
  extends RPCService<IRPCGptService>
  implements IAiBackService<IAiBackServiceResponse, Readable>
{
  async request<T = IAiBackServiceResponse<string>>(
    input: string,
    options: IAiBackServiceOption,
    cancelToken?: CancellationToken,
  ): Promise<T> {
    return void 0 as T;
  }
  async requestStream<T = IAiBackServiceResponse<string>>(
    input: string,
    options: IAiBackServiceOption,
    cancelToken?: CancellationToken,
  ): Promise<T> {
    return void 0 as T;
  }

  async requestCompletion<T = IAiCompletionResultModel>(input: IAiCompletionOption, cancelToken?: CancellationToken) {
    return void 0 as T;
  }

  async reportCompletion<T = IAiReportCompletionOption>(input: IAiReportCompletionOption) {}

  async destroyStreamRequest(sessionId: string) {}
}

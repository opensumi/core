import { Readable } from 'stream';

import { Injectable } from '@opensumi/di';

import { RPCService } from '../proxy';
import { CancellationToken } from '../utils';

import {
  CompletionResultModel,
  IAiBackService,
  IAiBackServiceOption,
  IAiBackServiceResponse,
  IAiCompletionOption,
  IAiReportCompletionOption,
} from '.';

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

  async requestCompletion<T = CompletionResultModel>(input: IAiCompletionOption, cancelToken?: CancellationToken) {
    return void 0 as T;
  }

  async reportCompletion<T = IAiReportCompletionOption>(input: IAiReportCompletionOption) {}

  async destroyStreamRequest(sessionId: string) {}
}

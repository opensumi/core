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
  IChatProxyRPCService,
} from '@opensumi/ide-core-common';

@Injectable()
export class BaseAIBackService
  extends RPCService<IChatProxyRPCService>
  implements IAIBackService<IAIBackServiceResponse, Readable>
{
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

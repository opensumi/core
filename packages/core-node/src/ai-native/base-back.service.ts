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
} from '@opensumi/ide-core-common';

interface IRPCGptService {
  onMessage(msg: string, sessionId?: string): void;
}

@Injectable()
export class BaseAIBackService
  extends RPCService<IRPCGptService>
  implements IAIBackService<IAIBackServiceResponse, NodeJS.ReadableStream>
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
  ): Promise<any> {
    return;
  }

  async requestCompletion<T = IAICompletionResultModel>(input: IAICompletionOption, cancelToken?: CancellationToken) {
    return void 0 as T;
  }

  async reportCompletion<T = IAIReportCompletionOption>(input: IAIReportCompletionOption) {}

  async destroyStreamRequest(sessionId: string) {}
}

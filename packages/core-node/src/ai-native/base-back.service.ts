import { Injectable } from '@opensumi/di';
import {
  CancellationToken,
  IAIBackService,
  IAIBackServiceOption,
  IAIBackServiceResponse,
  IAICompletionOption,
  IAIReportCompletionOption,
  IChatProgress,
} from '@opensumi/ide-core-common';
import { SumiReadableStream } from '@opensumi/ide-utils/lib/stream';

export class ChatReadableStream extends SumiReadableStream<IChatProgress> {}

@Injectable()
export class BaseAIBackService implements IAIBackService<IAIBackServiceResponse, ChatReadableStream> {
  async request(
    input: string,
    options: IAIBackServiceOption,
    cancelToken?: CancellationToken,
  ): Promise<IAIBackServiceResponse<string>> {
    return {};
  }

  async requestStream(
    input: string,
    options: IAIBackServiceOption,
    cancelToken?: CancellationToken,
  ): Promise<ChatReadableStream> {
    return new ChatReadableStream();
  }
}

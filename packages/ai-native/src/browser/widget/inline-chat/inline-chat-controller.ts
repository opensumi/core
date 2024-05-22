import {
  AbortError,
  ChatResponse,
  ErrorResponse,
  IChatContent,
  IChatProgress,
  ReplyResponse,
} from '@opensumi/ide-core-common';
import { SumiReadableStream, listenReadable } from '@opensumi/ide-utils/lib/stream';

export class InlineChatController {
  static is(controller: any): boolean {
    return controller instanceof InlineChatController && typeof controller.mountReadable === 'function';
  }

  private stream: SumiReadableStream<ChatResponse>;

  constructor() {
    this.stream = new SumiReadableStream<ChatResponse>();
  }

  public mountReadable(stream: SumiReadableStream<IChatProgress>): void {
    const reply = new ReplyResponse('');

    listenReadable<IChatProgress>(stream, {
      onData: (data) => {
        reply.updateMessage((data as IChatContent).content);
        this.stream.emitData(reply);
      },
      onEnd: () => {
        this.stream.end();
      },
      onError: (error) => {
        if (AbortError.is(error)) {
          this.stream.abort();
        } else {
          this.stream.emitData(new ErrorResponse(error));
        }
      },
    });
  }

  public getStream(): SumiReadableStream<ChatResponse> {
    return this.stream;
  }
}

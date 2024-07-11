import {
  AbortError,
  Deferred,
  Emitter,
  ErrorResponse,
  Event,
  IChatContent,
  IChatProgress,
  ReplyResponse,
} from '@opensumi/ide-core-common';
import { SumiReadableStream, listenReadable } from '@opensumi/ide-utils/lib/stream';

import { BACK_QUOTE_3_SYMBOL } from '../../../common';

export interface InlineChatControllerOptions {
  /**
   * 是否开启代码块渲染能力
   * 如果开启将只会渲染 ``` 里的代码块内容
   */
  enableCodeblockRender: boolean;
}
export class InlineChatController {
  static is(controller: any): controller is InlineChatController {
    return controller instanceof InlineChatController && typeof controller.mountReadable === 'function';
  }

  private readonly _onData = new Emitter<ReplyResponse>();
  public readonly onData: Event<ReplyResponse> = this._onData.event;

  private readonly _onEnd = new Emitter<void>();
  public readonly onEnd: Event<void> = this._onEnd.event;

  private readonly _onAbort = new Emitter<void>();
  public readonly onAbort: Event<void> = this._onAbort.event;

  private readonly _onError = new Emitter<ErrorResponse>();
  public readonly onError: Event<ErrorResponse> = this._onError.event;

  constructor(readonly options?: InlineChatControllerOptions) {}

  public deferred: Deferred<void> = new Deferred();

  private calculateCodeBlocks(content: string): string {
    if (!this.options?.enableCodeblockRender) {
      return content;
    }

    const lines = content.split('\n');

    let newContents: string[] = [];
    let inBlock = false;
    let startLine = 0;

    lines.forEach((line, i) => {
      if (!inBlock && line.startsWith(BACK_QUOTE_3_SYMBOL)) {
        inBlock = true;
        startLine = i + 1;
      } else if (inBlock && line.startsWith(BACK_QUOTE_3_SYMBOL)) {
        inBlock = false;
        const endLine = i;
        newContents = lines.slice(startLine, endLine);
      }

      if (inBlock && startLine !== i + 1) {
        newContents.push(line);
      }
    });

    return newContents.join('\n');
  }

  public async mountReadable(stream: SumiReadableStream<IChatProgress>): Promise<void> {
    await this.deferred.promise;
    const reply = new ReplyResponse('');
    let wholeContent = '';

    listenReadable<IChatProgress>(stream, {
      onData: (data) => {
        const chatContent = (data as IChatContent).content;
        wholeContent += chatContent;

        const content = this.calculateCodeBlocks(wholeContent);
        reply.updateMessage(content);
        this._onData.fireAndAwait(reply);
      },
      onEnd: () => {
        this._onEnd.fire();
      },
      onError: (error) => {
        if (AbortError.is(error)) {
          this._onAbort.fire();
        } else {
          this._onError.fire(new ErrorResponse(error));
        }
      },
    });
  }
}

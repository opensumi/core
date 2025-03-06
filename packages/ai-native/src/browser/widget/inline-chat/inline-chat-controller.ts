import {
  AbortError,
  Emitter,
  ErrorResponse,
  Event,
  IChatContent,
  IChatProgress,
  ReplyResponse,
} from '@opensumi/ide-core-common';
import { SumiReadableStream, listenReadable } from '@opensumi/ide-utils/lib/stream';

import { extractCodeBlocks } from '../../../common/utils';

export interface InlineChatControllerOptions {
  /**
   * 是否开启代码块渲染能力
   * 如果开启将只会渲染 ``` 里的代码块内容
   */
  enableCodeblockRender: boolean;
}

/**
 * inline chat 的流式控制器
 */
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

  private calculateCodeBlocks(content: string): string {
    if (!this.options?.enableCodeblockRender) {
      return content;
    }

    return extractCodeBlocks(content);
  }

  protected _stream: SumiReadableStream<IChatProgress> | null = null;
  public mountReadable(stream: SumiReadableStream<IChatProgress>): void {
    this._stream = stream;
  }

  protected _listened = false;

  get isListened(): boolean {
    return this._listened;
  }

  public listen() {
    if (this._listened) {
      return;
    }

    if (!this._stream) {
      throw new Error('No Stream mounted');
    }

    this._listened = true;

    const reply = new ReplyResponse('');
    let wholeContent = '';

    listenReadable<IChatProgress>(this._stream, {
      onData: (data) => {
        wholeContent += (data as IChatContent).content;

        const content = this.calculateCodeBlocks(wholeContent);
        reply.updateMessage(content);
        this._onData.fire(reply);
      },
      onEnd: () => {
        if (!wholeContent) {
          this._onError.fire(new ErrorResponse(new Error('No content')));
        } else {
          this._onEnd.fire();
        }
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

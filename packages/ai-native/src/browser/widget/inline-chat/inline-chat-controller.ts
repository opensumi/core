import {
  AbortError,
  ChatResponse,
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

const rgCodeBlockBefore = /```([a-zA-Z]+)?\n([\s\S]*)/;
const rgCodeBlockAfter = /([\s\S]+)?\n?```/;

export class InlineChatController {
  static is(controller: any): boolean {
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

  private isInCodeBlock = false;

  constructor(readonly options?: InlineChatControllerOptions) {}

  public deffered: Deferred<void> = new Deferred();

  private fencedCodeBlocks(content: string): string {
    let _content = content;

    if (!this.options?.enableCodeblockRender) {
      return _content;
    }

    if (_content.includes(BACK_QUOTE_3_SYMBOL)) {
      if (!this.isInCodeBlock) {
        // 第一次进入代码块时，去除反引号符号
        const match = _content.match(rgCodeBlockBefore);
        if (match && match.length >= 3) {
          _content = match[2];
        }
      } else {
        const match = _content.match(rgCodeBlockAfter);
        if (match && match.length >= 2) {
          _content = match[1];
        }
      }

      this.isInCodeBlock = !this.isInCodeBlock;
      return _content || '';
    }

    if (this.isInCodeBlock) {
      return _content;
    }

    return '';
  }

  public mountReadable(stream: SumiReadableStream<IChatProgress>): void {
    const reply = new ReplyResponse('');

    listenReadable<IChatProgress>(stream, {
      onData: async (data) => {
        reply.updateMessage(this.fencedCodeBlocks((data as IChatContent).content));
        await this.deffered.promise;
        this._onData.fire(reply);
      },
      onEnd: async () => {
        this.isInCodeBlock = false;
        await this.deffered.promise;
        this._onEnd.fire();
      },
      onError: async (error) => {
        this.isInCodeBlock = false;
        await this.deffered.promise;
        if (AbortError.is(error)) {
          this._onAbort.fire();
        } else {
          this._onError.fire(new ErrorResponse(error));
        }
      },
    });
  }
}

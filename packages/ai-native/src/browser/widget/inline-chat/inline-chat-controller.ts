import {
  AbortError,
  ChatResponse,
  ErrorResponse,
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

const rgCodeBlockBefore = /\n([^]+)?/g;

export class InlineChatController {
  static is(controller: any): boolean {
    return controller instanceof InlineChatController && typeof controller.mountReadable === 'function';
  }

  private stream: SumiReadableStream<ChatResponse>;
  private isInCodeBlock = false;

  constructor(readonly options?: InlineChatControllerOptions) {
    this.stream = new SumiReadableStream<ChatResponse>();
  }

  private fencedCodeBlocks(content: string): string {
    let _content = content;

    if (!this.options?.enableCodeblockRender) {
      return _content;
    }

    if (_content.includes(BACK_QUOTE_3_SYMBOL)) {
      if (!this.isInCodeBlock) {
        // 第一次进入代码块时，去除反引号符号
        const chunks = _content.split(rgCodeBlockBefore).filter(Boolean);
        if (chunks.length >= 2) {
          _content = chunks[1];
        }
      }

      this.isInCodeBlock = !this.isInCodeBlock;
    }

    if (!this.isInCodeBlock) {
      _content = '';
    }

    return _content;
  }

  public mountReadable(stream: SumiReadableStream<IChatProgress>): void {
    const reply = new ReplyResponse('');

    listenReadable<IChatProgress>(stream, {
      onData: (data) => {
        reply.updateMessage(this.fencedCodeBlocks((data as IChatContent).content));
        this.stream.emitData(reply);
      },
      onEnd: () => {
        this.isInCodeBlock = false;
        this.stream.end();
      },
      onError: (error) => {
        this.isInCodeBlock = false;
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

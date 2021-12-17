import { Disposable, IDisposable } from '@opensumi/ide-core-common';
import { AbstractMessageReader, DataCallback } from '@opensumi/vscode-jsonrpc/lib/common/messageReader';

/**
 * 支持通过RPC通道读取消息.
 */
export class ExtensionMessageReader extends AbstractMessageReader {
  protected state: 'initial' | 'listening' | 'closed' = 'initial';
  protected callback: DataCallback | undefined;
  protected events: { message?: any; error?: any }[] = [];

  constructor() {
    super();
  }

  listen(callback: DataCallback): IDisposable {
    if (this.state === 'initial') {
      this.state = 'listening';
      this.callback = callback;
      while (this.events.length !== 0) {
        const event = this.events.pop()!;
        if (event.message) {
          this.readMessage(event.message);
        } else if (event.error) {
          this.fireError(event.error);
        } else {
          this.fireClose();
        }
      }
    }

    return Disposable.create(() => {
      this.state = 'closed';
      this.callback = undefined;
      this.events = [];
    });
  }

  readMessage(message: string): void {
    if (this.state === 'initial') {
      this.events.splice(0, 0, { message });
    } else if (this.state === 'listening') {
      const data = JSON.parse(message);
      this.callback!(data);
    }
  }

  fireError(error: any): void {
    if (this.state === 'initial') {
      this.events.splice(0, 0, { error });
    } else if (this.state === 'listening') {
      super.fireError(error);
    }
  }

  fireClose(): void {
    if (this.state === 'initial') {
      this.events.splice(0, 0, {});
    } else if (this.state === 'listening') {
      super.fireClose();
    }
    this.state = 'closed';
  }
}

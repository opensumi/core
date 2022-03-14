import { Message } from '@opensumi/vscode-jsonrpc/lib/common/messages';
import { AbstractMessageWriter, MessageWriter } from '@opensumi/vscode-jsonrpc/lib/common/messageWriter';

import { IExtHostConnection } from './connection';

/**
 * 支持通过RPC通道写消息
 */
export class ExtensionMessageWriter extends AbstractMessageWriter implements MessageWriter {
  constructor(protected readonly id: string, protected readonly proxy: IExtHostConnection) {
    super();
  }

  write(arg: string | Message): Promise<void> {
    const content = JSON.stringify(arg);
    this.proxy.$sendMessage(this.id, content);
    return Promise.resolve();
  }

  end() {}
}

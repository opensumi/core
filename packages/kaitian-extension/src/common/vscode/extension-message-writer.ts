import { AbstractMessageWriter, MessageWriter } from '@ali/vscode-jsonrpc/lib/common/messageWriter';
import { Message } from '@ali/vscode-jsonrpc/lib/common/messages';
import { IExtHostConnection } from './connection';

/**
 * 支持通过RPC通道写消息
 */
export class ExtensionMessageWriter extends AbstractMessageWriter implements MessageWriter {
    constructor(
        protected readonly id: string,
        protected readonly proxy: | IExtHostConnection) {
        super();
    }

    write(arg: string | Message): Promise<void> {
        const content = JSON.stringify(arg);
        this.proxy.$sendMessage(this.id, content);
        return Promise.resolve();
    }

    end() {}
}

import { AbstractMessageWriter, MessageWriter } from 'vscode-jsonrpc/lib/messageWriter';
import { Message } from 'vscode-jsonrpc';
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

    write(arg: string | Message): void {
        const content = JSON.stringify(arg);
        this.proxy.$sendMessage(this.id, content);
    }
}

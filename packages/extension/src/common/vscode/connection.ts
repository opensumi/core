import { IWebSocket } from '@opensumi/ide-connection';
import { IDisposable } from '@opensumi/ide-core-common';
import { MessageReader } from '@opensumi/vscode-jsonrpc/lib/common/messageReader';
import { Message } from '@opensumi/vscode-jsonrpc/lib/common/messages';
import { MessageWriter } from '@opensumi/vscode-jsonrpc/lib/common/messageWriter';

import { ExtensionMessageReader } from './extension-message-reader';
import { ExtensionMessageWriter } from './extension-message-writer';


export interface IMainThreadConnection {
  $createConnection(id: string): Promise<void>;
  $deleteConnection(id: string): Promise<void>;
  $sendMessage(id: string, message: string): void;
}

export interface IExtHostConnection {
  $createConnection(id: string): Promise<void>;
  $deleteConnection(id: string): Promise<void>;
  $sendMessage(id: string, message: string): void;
}

export interface IMainThreadConnectionService extends IMainThreadConnection {
  ensureConnection(id: string): Promise<ExtensionConnection>;
}

export interface IExtHostConnectionService extends IExtHostConnection {
  ensureConnection(id: string): Promise<ExtensionConnection>;
}

/**
 * 插件进程与主进程的通讯层定义
 */
export interface Connection extends IDisposable {
  readonly reader: MessageReader;
  readonly writer: MessageWriter;
  /**
   * 向另一个Connection转发消息.
   *
   * @param to 目标Connection
   * @param map 可以在转发前对消息进行二次处理
   */
  forward(to: Connection, map?: (message: Message) => Message): void;
}

export class ExtensionConnection implements Connection {
  constructor(
    readonly reader: ExtensionMessageReader,
    readonly writer: ExtensionMessageWriter,
    readonly dispose: () => void,
  ) {}

  forward(to: Connection, map: (message: Message) => Message = (message) => message): void {
    this.reader.listen((input) => {
      const output = map(input);
      to.writer.write(output);
    });
  }
}

// DI Token用于引入其他主进程模块
export const IMainThreadConnectionService = Symbol('MainThreadConnectionService');

export class ExtensionWSChannel implements IWebSocket {
  constructor(protected readonly connection: ExtensionConnection) {}

  send(content: string): void {
    this.connection.writer.write(content);
  }

  onMessage(cb: (data: any) => void): void {
    this.connection.reader.listen(cb);
  }

  onError(cb: (reason: any) => void): void {
    this.connection.reader.onError((e) => cb(e));
  }

  onClose(cb: (code: number, reason: string) => void): void {
    this.connection.reader.onClose(() => cb(-1, 'closed'));
  }

  close(): void {
    this.connection.dispose();
  }
}

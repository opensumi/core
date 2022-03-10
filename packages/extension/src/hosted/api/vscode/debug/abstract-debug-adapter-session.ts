import type vscode from 'vscode';

import { IWebSocket } from '@opensumi/ide-connection';
import { Disposable, DisposableCollection, Event } from '@opensumi/ide-core-common';
import { DebugStreamConnection } from '@opensumi/ide-debug';
import { getSequenceId } from '@opensumi/ide-debug';
import { DebugProtocol } from '@opensumi/vscode-debugprotocol';

export abstract class AbstractDebugAdapter implements vscode.DebugAdapter {
  constructor(readonly id: string) {}

  onDidSendMessage: Event<vscode.DebugProtocolMessage>;
  handleMessage: (message: vscode.DebugProtocolMessage) => void;
  dispose: () => unknown;
}

export class DirectDebugAdapter extends AbstractDebugAdapter {
  constructor(public id: string, public readonly implementation: vscode.DebugAdapter) {
    super(id);
  }

  start(channel: NodeJS.ReadableStream, outStream: NodeJS.WritableStream): void {
    // @ts-ignore
    this.implementation.start(channel, outStream);
  }

  sendMessage(message: DebugProtocol.ProtocolMessage): void {
    this.implementation.handleMessage(message);
  }

  stopSession(): Promise<void> {
    this.implementation.dispose();
    return Promise.resolve(undefined);
  }
}

export abstract class StreamDebugAdapter extends AbstractDebugAdapter {
  private static TWO_CRLF = '\r\n\r\n';
  private static CONTENT_LENGTH = 'Content-Length';

  private readonly toDispose = new DisposableCollection();
  private channel: IWebSocket | undefined;
  private contentLength: number;
  private buffer: Buffer;

  constructor(readonly id: string, protected readonly debugStreamConnection: DebugStreamConnection) {
    super(id);
    this.contentLength = -1;
    this.buffer = Buffer.alloc(0);
    this.toDispose.pushAll([
      this.debugStreamConnection,
      Disposable.create(() =>
        this.write(JSON.stringify({ seq: getSequenceId(), type: 'request', command: 'disconnect' })),
      ),
      Disposable.create(() =>
        this.write(JSON.stringify({ seq: getSequenceId(), type: 'request', command: 'terminate' })),
      ),
    ]);
  }

  async start(channel: IWebSocket): Promise<void> {
    if (this.channel) {
      throw new Error('The session has already been started, id: ' + this.id);
    }
    this.channel = channel;
    this.channel.onMessage((message: string) => this.write(message));
    this.channel.onClose(() => (this.channel = undefined));

    this.debugStreamConnection.output.on('data', (data: Buffer) => this.handleData(data));
    this.debugStreamConnection.output.on('close', () => this.onDebugAdapterExit(1, undefined));
    this.debugStreamConnection.output.on('error', (error) => this.onDebugAdapterError(error));
    this.debugStreamConnection.input.on('error', (error) => this.onDebugAdapterError(error));
  }

  protected onDebugAdapterExit(exitCode: number, signal: string | undefined): void {
    const event: DebugProtocol.ExitedEvent = {
      type: 'event',
      event: 'exited',
      seq: getSequenceId(),
      body: {
        exitCode,
      },
    };
    this.send(JSON.stringify(event));
  }

  protected onDebugAdapterError(error: Error): void {
    const event: DebugProtocol.Event = {
      type: 'event',
      event: 'error',
      seq: getSequenceId(),
      body: error,
    };
    this.send(JSON.stringify(event));
  }

  protected handleData(data: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, data]);

    while (true) {
      if (this.contentLength >= 0) {
        if (this.buffer.length >= this.contentLength) {
          const message = this.buffer.toString('utf8', 0, this.contentLength);
          this.buffer = this.buffer.slice(this.contentLength);
          this.contentLength = -1;

          if (message.length > 0) {
            this.send(message);
          }
          continue;
        }
      } else {
        let idx = this.buffer.indexOf(StreamDebugAdapter.CONTENT_LENGTH);
        if (idx > 0) {
          this.buffer.slice(0, idx);
          this.buffer = this.buffer.slice(idx);
        }

        idx = this.buffer.indexOf(StreamDebugAdapter.TWO_CRLF);
        if (idx !== -1) {
          const header = this.buffer.toString('utf8', 0, idx);
          const lines = header.split('\r\n');
          for (const line of lines) {
            const pair = line.split(/: +/);
            if (pair[0] === StreamDebugAdapter.CONTENT_LENGTH) {
              this.contentLength = +pair[1];
            }
          }
          this.buffer = this.buffer.slice(idx + StreamDebugAdapter.TWO_CRLF.length);
          continue;
        }
      }
      break;
    }
  }

  protected send(message: string): void {
    if (this.channel) {
      this.channel.send(message);
    }
  }

  protected write(message: string): void {
    // 在自定义 bash 模式下，需要使用 \r\n 来保证被写入
    const finalMessage = message + '\r\n';
    // 在 Stream 关闭后不再发送消息
    if (this.debugStreamConnection.input.writable) {
      this.debugStreamConnection.input.write(
        `Content-Length: ${Buffer.byteLength(finalMessage, 'utf8')}\r\n\r\n${finalMessage}`,
        'utf8',
      );
    }
  }

  async stop(): Promise<void> {
    this.toDispose.dispose();
  }
}

import type vscode from 'vscode';

import { Disposable, DisposableCollection, Emitter, Event } from '@opensumi/ide-core-common';
import { DebugStreamConnection } from '@opensumi/ide-debug';
import { getSequenceId } from '@opensumi/ide-debug';
import { DebugProtocol } from '@opensumi/vscode-debugprotocol';

import { ExtensionConnection } from '../../../../common/vscode';

export abstract class AbstractDebugAdapter implements vscode.DebugAdapter {
  constructor(readonly id: string) {}

  onDidSendMessage: Event<vscode.DebugProtocolMessage>;
  handleMessage: (message: vscode.DebugProtocolMessage) => void;
  dispose: () => unknown;
}

export class DirectDebugAdapter extends AbstractDebugAdapter {
  private messageReceivedEmitter = new Emitter<string>();
  private closeEmitter = new Emitter<void>();
  onError: Event<Error> = Event.None;

  constructor(public id: string, public readonly implementation: vscode.DebugAdapter) {
    super(id);
    this.implementation.onDidSendMessage((msg) => {
      this.messageReceivedEmitter.fire(JSON.stringify(msg));
    });
  }

  get onClose() {
    return this.closeEmitter.event;
  }

  get onMessageReceived() {
    return this.messageReceivedEmitter.event;
  }

  async start(): Promise<void> {}

  sendMessage(message: DebugProtocol.ProtocolMessage): void {
    this.implementation.handleMessage(message);
  }

  async stop(): Promise<void> {
    this.implementation.dispose();
  }
}

/**
 * communicate with debug adapter via stream
 */
export abstract class StreamDebugAdapter extends AbstractDebugAdapter {
  private static TWO_CRLF = '\r\n\r\n';
  private static CRLF = '\r\n';
  private static CONTENT_LENGTH = 'Content-Length';
  // allow for non-RFC 2822 conforming line separators
  private static readonly HEADER_LINE_SEPARATOR = /\r?\n/;
  private static readonly HEADER_FIELD_SEPARATOR = /: +/;

  private readonly toDispose = new DisposableCollection();
  private contentLength: number;
  private buffer: Buffer;

  private frontendConnection: ExtensionConnection;

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

  async start(connection: ExtensionConnection): Promise<void> {
    if (this.frontendConnection) {
      throw new Error('The session has already been started, id: ' + this.id);
    }

    this.frontendConnection = connection;
    this.frontendConnection.onMessage((message) => this.write(message));
    this.frontendConnection.onceClose(() => (this.frontendConnection = undefined!));

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
    this.sendToFrontend(JSON.stringify(event));
  }

  protected onDebugAdapterError(error: Error): void {
    const event: DebugProtocol.Event = {
      type: 'event',
      event: 'error',
      seq: getSequenceId(),
      body: error,
    };
    this.sendToFrontend(JSON.stringify(event));
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
            this.sendToFrontend(message);
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
          const lines = header.split(StreamDebugAdapter.HEADER_LINE_SEPARATOR);
          for (const line of lines) {
            const pair = line.split(StreamDebugAdapter.HEADER_FIELD_SEPARATOR);
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

  protected sendToFrontend(message: string): void {
    if (this.frontendConnection) {
      this.frontendConnection.send(message);
    }
  }

  protected write(message: string): void {
    // In the custom bash mode, it is necessary to use \r\n to ensure that it is written in.
    const finalMessage = message + StreamDebugAdapter.CRLF;
    // No more messages will be sent after the Stream is closed.
    if (this.debugStreamConnection.input.writable) {
      this.debugStreamConnection.input.write(
        `Content-Length: ${Buffer.byteLength(finalMessage, 'utf8')}${StreamDebugAdapter.TWO_CRLF}${finalMessage}`,
        'utf8',
      );
    }
  }

  async stop(): Promise<void> {
    this.toDispose.dispose();
  }
}

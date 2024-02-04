import { EventEmitter } from '@opensumi/events';
import { BaseConnection } from '@opensumi/ide-connection/lib/common/connection';
import { IDisposable } from '@opensumi/ide-core-common';

export interface IInterProcessConnection {
  $createConnection(id: string): Promise<void>;
  $deleteConnection(id: string): Promise<void>;
  $sendMessage(id: string, message: string): Promise<void>;
}

export const IInterProcessConnectionService = Symbol('IInterProcessConnectionService');
export interface IInterProcessConnectionService extends IInterProcessConnection {
  ensureConnection(id: string): Promise<ExtensionConnection>;
}

/**
 * Definition of the communication layer between the ext process and the main process
 */
export class ExtensionConnection implements BaseConnection<string> {
  emitter = new EventEmitter<{
    message: [string];
    close: [code?: number, reason?: string];
  }>();

  constructor(
    protected readonly id: string,
    protected readonly proxy: IInterProcessConnection,
    readonly dispose: () => void,
  ) {}
  send(data: string): void {
    this.proxy.$sendMessage(this.id, data);
  }
  onMessage(cb: (data: string) => void): IDisposable {
    return this.emitter.on('message', cb);
  }

  onceClose(cb: (code?: number, reason?: string) => void): IDisposable {
    return this.emitter.on('close', () => cb(-1, 'closed'));
  }

  close() {
    this.emitter.dispose();
    this.dispose();
  }

  readMessage(message: string): void {
    this.emitter.emit('message', message);
  }

  fireClose() {
    this.emitter.emit('close');
  }
}

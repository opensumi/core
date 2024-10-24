import { ITerminalAddon, Terminal } from '@xterm/xterm';

import { Disposable, Emitter } from '@opensumi/ide-core-common';

import { ITerminalConnection } from '../common';

export class AttachAddon extends Disposable implements ITerminalAddon {
  connection: ITerminalConnection | undefined;
  private _disposeConnection: Disposable | null;
  private _terminal: Terminal;

  private _onData = new Emitter<string | ArrayBuffer>();
  onData = this._onData.event;

  private _onExit = new Emitter<number | undefined>();
  onExit = this._onExit.event;

  private _onTime = new Emitter<number>();
  onTime = this._onTime.event;

  private _lastInputTime = 0;

  private readonly _onBeforeProcessData = new Emitter<{ data: string }>();
  readonly onBeforeProcessData = this._onBeforeProcessData.event;

  public setConnection(connection: ITerminalConnection | undefined) {
    if (this._disposeConnection) {
      this._disposeConnection.dispose();
      this._disposeConnection = null;
    }
    this.connection = connection;
    if (connection) {
      this._disposeConnection = new Disposable(
        connection.onData((data: string | ArrayBuffer) => {
          let dataToWrite = data;
          if (typeof data === 'string') {
            const beforeProcessDataEvent = { data } as { data: string };
            // 通过 EventEmitter 修改终端 data 的内容
            this._onBeforeProcessData.fire(beforeProcessDataEvent);

            if (beforeProcessDataEvent.data !== undefined) {
              dataToWrite = beforeProcessDataEvent.data;
            }
          }

          this._onData.fire(dataToWrite);

          this._terminal.write(
            typeof dataToWrite === 'string' ? dataToWrite : new Uint8Array(dataToWrite, 0, dataToWrite.byteLength),
          );

          // connection.onData 的时候对 lastInputTime 进行差值运算，统计最后一次输入到收到回复的时间间隔
          if (this._lastInputTime) {
            const delta = Date.now() - this._lastInputTime;
            this._lastInputTime = 0;
            this._onTime.fire(delta);
          }
        }),
      );
      if (connection.onExit) {
        this._disposeConnection.addDispose(
          connection.onExit((code) => {
            this._onExit.fire(code);
          }),
        );
      }
    }
  }

  public async activate(terminal: Terminal): Promise<void> {
    this._terminal = terminal;
    this.addDispose(Disposable.create(() => this._disposeConnection?.dispose()));
    this.addDispose(terminal.onData((data) => this._sendData(data)));
    this.addDispose(terminal.onBinary((data) => this._sendBinary(data)));
  }

  private _sendData(data: string): void {
    if (!this.connection || this.connection.readonly) {
      return;
    }
    // 记录 lastInputTime，用于终端反应速度统计
    this._timeResponse();
    this.connection.sendData(data);
  }

  private _sendBinary(data: string): void {
    if (!this.connection || this.connection.readonly) {
      return;
    }
    const buffer = new Uint8Array(data.length);
    for (let i = 0; i < data.length; ++i) {
      buffer[i] = data.charCodeAt(i) & 255;
    }
    this._timeResponse();
    this.connection.sendData(buffer);
  }

  private _timeResponse() {
    this._lastInputTime = Date.now();
  }
}

export const DEFAULT_ROW = 80;
export const DEFAULT_COL = 24;

import { IRPCProtocol } from '@opensumi/ide-connection';
import { Emitter, Event } from '@opensumi/ide-core-common';

import { IExtHostOutput, IMainThreadOutput, MainThreadAPIIdentifier } from '../../../common/vscode';
import * as types from '../../../common/vscode/ext-types';

export class ExtHostOutput implements IExtHostOutput {
  constructor(private rpcProtocol: IRPCProtocol) {}

  createOutputChannel(name: string): types.OutputChannel;
  createOutputChannel(name: string, options: { log?: true }): types.LogOutputChannel;
  createOutputChannel(name: string, options?: { log?: true }): types.OutputChannel {
    if (options?.log) {
      return new LogOutputChannelImpl(name, this.rpcProtocol, types.OutputChannelLogLevel.Info);
    }
    return new OutputChannelImpl(name, this.rpcProtocol);
  }
}

// 批处理字符最大长度
const OUTPUT_BATCH_MAX_SIZE = 20 * 1024;
// 批处理延时
const OUTPUT_BATCH_DURATION_MS = 5;

export class OutputChannelImpl implements types.OutputChannel {
  private disposed: boolean;

  private proxy: IMainThreadOutput;

  private batchedOutputLine = '';

  private batchedTimer: NodeJS.Timeout | null = null;

  constructor(readonly name: string, private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadOutput);
  }

  replace(value: string): void {
    this.proxy.$replace(this.name, value);
  }

  dispose(): void {
    if (!this.disposed) {
      this.proxy.$dispose(this.name).then(() => {
        this.disposed = true;
      });
    }
  }

  append(value: string): void {
    this.validate();
    const data = this.batchedOutputLine + value;
    this.batchedOutputLine = data;

    if (this.batchedOutputLine.length >= OUTPUT_BATCH_MAX_SIZE) {
      this.flushOutputString();
    }

    if (!this.batchedTimer) {
      this.batchedTimer = global.setTimeout(() => this.flushOutputString(), OUTPUT_BATCH_DURATION_MS);
    }
  }

  appendLine(value: string): void {
    this.validate();
    this.append(value + '\n');
  }

  clear(): void {
    this.validate();
    this.proxy.$clear(this.name);
  }

  protected flushOutputString() {
    this.proxy.$append(this.name, this.batchedOutputLine);
    this.batchedOutputLine = '';
    if (this.batchedTimer) {
      global.clearTimeout(this.batchedTimer);
      this.batchedTimer = null;
    }
  }

  show(preserveFocus: boolean | undefined): void {
    this.validate();
    this.proxy.$reveal(this.name, !!preserveFocus);
  }

  hide(): void {
    this.validate();
    this.proxy.$close(this.name);
  }

  protected validate(): void {
    if (this.disposed) {
      throw new Error('Channel has been closed');
    }
  }
}

export class LogOutputChannelImpl extends OutputChannelImpl implements types.LogOutputChannel {
  logLevel: types.OutputChannelLogLevel = types.OutputChannelLogLevel.Info;

  private onDidChangeLogLevelEmitter: Emitter<types.OutputChannelLogLevel> = new Emitter<types.OutputChannelLogLevel>();
  onDidChangeLogLevel: Event<types.OutputChannelLogLevel> = this.onDidChangeLogLevelEmitter.event;

  constructor(name: string, rpcProtocol: IRPCProtocol, logLevel: types.OutputChannelLogLevel) {
    super(name, rpcProtocol);
    this.logLevel = logLevel;
  }

  private data2String(data: any): string {
    if (data instanceof Error) {
      return data.stack || data.message;
    }
    if (data.success === false && data.message) {
      return data.message;
    }
    return data.toString();
  }

  private now(): string {
    const now = new Date();
    return (
      padLeft(now.getUTCHours() + '', 2, '0') +
      ':' +
      padLeft(now.getMinutes() + '', 2, '0') +
      ':' +
      padLeft(now.getUTCSeconds() + '', 2, '0') +
      '.' +
      now.getMilliseconds()
    );
  }

  private logWithLevel(level: types.OutputChannelLogLevel, message: string, data?: any): void {
    this.append(`[${level}  - ${this.now()}] ${message}`);
    if (data) {
      this.append(this.data2String(data));
    }
  }

  trace(message: string, ...args: any[]): void {
    this.logWithLevel(types.OutputChannelLogLevel.Trace, message, args);
  }

  debug(message: string, ...args: any[]): void {
    this.logWithLevel(types.OutputChannelLogLevel.Debug, message, args);
  }

  info(message: string, ...args: any[]): void {
    this.logWithLevel(types.OutputChannelLogLevel.Info, message, args);
  }

  warn(message: string, ...args: any[]): void {
    this.logWithLevel(types.OutputChannelLogLevel.Warning, message, args);
  }

  error(error: string | Error, ...args: any[]): void {
    this.logWithLevel(types.OutputChannelLogLevel.Error, error.toString(), args);
  }
}

function padLeft(s: string, n: number, pad = ' ') {
  return pad.repeat(Math.max(0, n - s.length)) + s;
}

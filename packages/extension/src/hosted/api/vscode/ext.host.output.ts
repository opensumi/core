import { IRPCProtocol } from '@opensumi/ide-connection';
import { Emitter, Event, getErrorMessage, isString } from '@opensumi/ide-core-common';

import {
  ICreateOutputChannelOptions,
  IExtHostOutput,
  IMainThreadOutput,
  MainThreadAPIIdentifier,
} from '../../../common/vscode';
import * as types from '../../../common/vscode/ext-types';

export class ExtHostOutput implements IExtHostOutput {
  constructor(private rpcProtocol: IRPCProtocol) {}

  createOutputChannel(name: string): types.OutputChannel;
  createOutputChannel(name: string, options: string | ICreateOutputChannelOptions): types.LogOutputChannel;
  createOutputChannel(name: string, optionsOrLangId?: string | ICreateOutputChannelOptions): types.OutputChannel {
    name = name.trim();
    if (!name) {
      throw new Error('illegal argument `name`. must not be falsy');
    }
    let log = false;
    let languageId: string | undefined;
    if (typeof optionsOrLangId === 'object') {
      log = !!optionsOrLangId.log;
      languageId = optionsOrLangId.languageId;
    } else if (isString(optionsOrLangId)) {
      languageId = optionsOrLangId;
    }

    if (isString(languageId) && !languageId.trim()) {
      throw new Error('illegal argument `languageId`. must not be empty');
    }

    const logLevel = types.OutputChannelLogLevel.Info;

    let instance: OutputChannelImpl | LogOutputChannelImpl;
    if (log) {
      instance = new LogOutputChannelImpl(name, this.rpcProtocol, logLevel);
    } else {
      instance = new OutputChannelImpl(name, this.rpcProtocol);
    }

    if (languageId) {
      instance.setLanguageId(languageId);
    }

    return instance;
  }
}

// 批处理字符最大长度
const OUTPUT_BATCH_MAX_SIZE = 20 * 1024;
// 批处理延时
const OUTPUT_BATCH_DURATION_MS = 5;

export class OutputChannelImpl implements types.OutputChannel {
  private disposed: boolean;

  readonly #proxy: IMainThreadOutput;

  private batchedOutputLine = '';

  private batchedTimer: NodeJS.Timeout | null = null;

  constructor(readonly name: string, rpcProtocol: IRPCProtocol) {
    this.#proxy = rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadOutput);
  }

  replace(value: string): void {
    this.#proxy.$replace(this.name, value);
  }

  dispose(): void {
    if (!this.disposed) {
      this.#proxy.$dispose(this.name).then(() => {
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
      this.batchedTimer = setTimeout(() => this.flushOutputString(), OUTPUT_BATCH_DURATION_MS);
    }
  }

  appendLine(value: string): void {
    this.validate();
    this.#proxy.$appendLine(this.name, value);
  }

  clear(): void {
    this.validate();
    this.#proxy.$clear(this.name);
  }

  protected flushOutputString() {
    this.#proxy.$append(this.name, this.batchedOutputLine);
    this.batchedOutputLine = '';
    if (this.batchedTimer) {
      clearTimeout(this.batchedTimer);
      this.batchedTimer = null;
    }
  }

  show(preserveFocus: boolean | undefined): void {
    this.validate();
    this.#proxy.$reveal(this.name, !!preserveFocus);
  }

  hide(): void {
    this.validate();
    this.#proxy.$close(this.name);
  }

  setLanguageId(languageId: string): void {
    this.#proxy.$setLanguageId(this.name, languageId);
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

    this.trace = this.trace.bind(this);
    this.debug = this.debug.bind(this);
    this.info = this.info.bind(this);
    this.warn = this.warn.bind(this);
    this.error = this.error.bind(this);
  }

  private data2String(data: any): string {
    if (data instanceof Error) {
      return getErrorMessage(data);
    }
    if (data.success === false && data.message) {
      return data.message;
    }
    return data.toString();
  }

  private now(): string {
    const toTwoDigits = (v: number) => (v < 10 ? `0${v}` : v);
    const toThreeDigits = (v: number) => (v < 10 ? `00${v}` : v < 100 ? `0${v}` : v);

    const now = new Date();
    const date = `${now.getFullYear()}-${toTwoDigits(now.getMonth() + 1)}-${toTwoDigits(now.getDate())}`;
    const time = `${toTwoDigits(now.getHours())}:${toTwoDigits(now.getMinutes())}:${toTwoDigits(
      now.getSeconds(),
    )}.${toThreeDigits(now.getMilliseconds())}`;
    return `${date} ${time}`;
  }

  private label(level: types.OutputChannelLogLevel) {
    switch (level) {
      case types.OutputChannelLogLevel.Trace:
        return 'trace';
      case types.OutputChannelLogLevel.Error:
        return 'error';
      case types.OutputChannelLogLevel.Warning:
        return 'warning';
      case types.OutputChannelLogLevel.Info:
        return 'info';
      case types.OutputChannelLogLevel.Debug:
        return 'debug';
      default:
        return '';
    }
  }

  private logWithLevel(level: types.OutputChannelLogLevel, message: string, data?: any): void {
    this.appendLine(`${this.now()} [${this.label(level)}] ${message}`);
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

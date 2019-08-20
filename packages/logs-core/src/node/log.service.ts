
import * as path from 'path';
import * as spdlog from 'spdlog';
import * as process from 'process';
import { Injectable, Autowired } from '@ali/common-di';
import { isUndefined } from '@ali/ide-core-common';
import { DebugLog } from '../common/debug';
import {
  ILogService,
  ILogServiceOptions,
  SimpleLogServiceOptions,
  LogLevel,
  SupportLogNamespace,
  ILogServiceManage,
  format,
  ILogServiceForClient,
} from '../common/';

type SpdLogger = spdlog.RotatingLogger;
interface ILog {
  level: LogLevel;
  message: string;
}

const LogLevelMessageMap = {
  [LogLevel.Verbose]: 'VERBOSE',
  [LogLevel.Debug]: 'DEBUG',
  [LogLevel.Info]: 'INFO',
  [LogLevel.Warning]: 'WARNING',
  [LogLevel.Error]: 'ERROR',
  [LogLevel.Critical]: 'CRITICAL',
};

export class LogService implements ILogService {
  private namespace: string;
  private logLevel: LogLevel;
  private logger: SpdLogger | undefined;
  private buffer: ILog[] = [];
  private spdLogLoggerPromise: Promise<SpdLogger | null> | undefined;
  private logServiceManage: ILogServiceManage;
  private pid: number;
  private debugLog: DebugLog;

  constructor(options: ILogServiceOptions) {
    this.setOptions(options);
    this.debugLog = new DebugLog(this.namespace);
    this.logServiceManage = options.logServiceManage;
    this.spdLogLoggerPromise = this.createSpdLogLoggerPromise(
      this.namespace,
      options.logServiceManage.getLogFolder(),
    );
  }

  setOptions(options: SimpleLogServiceOptions) {
    this.namespace = options.namespace || SupportLogNamespace.OTHER;
    this.logLevel = options.logLevel || LogLevel.Info;
    this.pid = options.pid || process.pid;
  }

  verbose(): void {
    const message = format(arguments);
    this.showDebugLog(LogLevel.Verbose, message);
    this.sendLog(LogLevel.Verbose, message);
  }

  debug(): void {
    const message = format(arguments);
    this.showDebugLog(LogLevel.Debug, message);
    this.sendLog(LogLevel.Debug, message);
  }

  log(): void {
    const message = format(arguments);
    this.showDebugLog(LogLevel.Info, message);
    this.sendLog(LogLevel.Info, message);
  }

  warn(): void {
    const message = format(arguments);
    this.showDebugLog(LogLevel.Warning, message);
    this.sendLog(LogLevel.Warning, message);
  }

  error(): void {
    const arg = arguments[0];
    let message: string;

    if (arg instanceof Error) {
      const array = Array.prototype.slice.call(arguments) as any[];
      array[0] = arg.stack;
      message = format(array);
      this.sendLog(LogLevel.Error, message);
    } else {
      message = format(arguments);
      this.sendLog(LogLevel.Error, message);
    }
    this.showDebugLog(LogLevel.Error, message);
  }

  critical(): void {
    const message = format(arguments);
    this.showDebugLog(LogLevel.Critical, message);
    this.sendLog(LogLevel.Critical, message);
  }

  getLevel(): LogLevel {
    return this.logLevel;
  }

  setLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  sendLog(level: LogLevel, message: string): void {
    if (this.getLevel() > level) {
      return;
    }
    if (this.logger) {
      this.doLog(this.logger, level, message);
    } else if (this.getLevel() <= level) {
      this.buffer.push({ level, message });
    }
  }

  dispose() {
    if (this.logger) {
      this.disposeLogger();
    } else if (this.spdLogLoggerPromise) {
      this.spdLogLoggerPromise.then(() => {
        this.disposeLogger();
      });
    }
    this.spdLogLoggerPromise = undefined;
    this.logServiceManage.removeLogger(this.namespace as SupportLogNamespace);
  }

  private disposeLogger(): void {
    if (this.logger) {
      this.logger.drop();
      this.logger = undefined;
    }
  }

  private async createSpdLogLoggerPromise(
    namespace: string,
    logsFolder: string,
  ): Promise<SpdLogger | null> {
    // Do not crash if spdlog cannot be loaded
    try {
      const _spdlog = require('spdlog');
      _spdlog.setAsyncMode(8192, 500);
      const logFilePath = path.join(logsFolder, `${namespace}.log`);
      return _spdlog.createRotatingLoggerAsync(namespace, logFilePath, 1024 * 1024 * 5, 6)
        .then((logger) => {
          if (logger) {
            this.logger = logger;
            this.logger!.setLevel(this.getLevel());
            this.logger!.setPattern('[%Y-%m-%d %H:%M:%S.%e]%v');
            for (const { level, message } of this.buffer) {
              this.doLog(this.logger!, level, message);
            }
            this.buffer = [];
          }
        });
    } catch (e) {
      console.error(e);
    }
    return null;
  }

  /**
   * 日志行格式 `[年-月-日 时:分:秒:毫秒][级别][PID]` 比如：
   * [2019-08-15 14:32:19.207][INFO][50715] log message!!!
   * [年-月-日 时:分:秒:毫秒] 由 spdlog 提供
   */
  private applyLogPreString(message: string) {
    const preString = `[${LogLevelMessageMap[this.logLevel]}][${this.pid}] `;
    return preString + message;
  }

  private doLog(logger: SpdLogger, level: LogLevel, message: string ): void {
    switch (level) {
      case LogLevel.Verbose:
        return logger.trace(this.applyLogPreString(message));
      case LogLevel.Debug:
        return logger.debug(this.applyLogPreString(message));
      case LogLevel.Info:
        return logger.info(this.applyLogPreString(message));
      case LogLevel.Warning:
        return logger.warn(this.applyLogPreString(message));
      case LogLevel.Error:
        return logger.error(this.applyLogPreString(message));
      case LogLevel.Critical:
        return logger.critical(this.applyLogPreString(message));
      default: throw new Error('Invalid log level');
    }
  }

  private showDebugLog(level: LogLevel, message: string ): void {
    switch (level) {
      case LogLevel.Verbose:
        return this.debugLog.verbose(message);
      case LogLevel.Debug:
        return this.debugLog.debug(message);
      case LogLevel.Info:
        return this.debugLog.info(message);
      case LogLevel.Warning:
        return this.debugLog.warn(message);
      case LogLevel.Error:
        return this.debugLog.error(message);
      case LogLevel.Critical:
        return this.debugLog.error(message);
      default: throw new Error('Invalid log level');
    }
  }
}

@Injectable()
export class LogServiceForClient implements ILogServiceForClient {

  @Autowired(ILogServiceManage)
  loggerManage: ILogServiceManage;

  getLevel(namespace: SupportLogNamespace) {
    return this.getLogger(namespace).getLevel();
  }

  setLevel(namespace: SupportLogNamespace, level: LogLevel) {
    this.getLogger(namespace).setLevel(level);
  }

  verbose(namespace: SupportLogNamespace,  message: string, pid?: number) {
    const logger = this.getLogger(namespace, {pid});
    logger.sendLog(LogLevel.Verbose, message);
  }

  debug(namespace: SupportLogNamespace,  message: string, pid?: number) {
    const logger = this.getLogger(namespace, {pid});
    logger.sendLog(LogLevel.Debug, message);
  }

  log(namespace: SupportLogNamespace,  message: string, pid?: number) {
    const logger = this.getLogger(namespace, {pid});
    logger.sendLog(LogLevel.Info, message);
  }

  warn(namespace: SupportLogNamespace,  message: string, pid?: number) {
    const logger = this.getLogger(namespace, {pid});
    logger.sendLog(LogLevel.Warning, message);
  }

  error(namespace: SupportLogNamespace,  message: string, pid?: number) {
    const logger = this.getLogger(namespace, {pid});
    logger.sendLog(LogLevel.Error, message);
  }

  critical(namespace: SupportLogNamespace,  message: string, pid?: number) {
    const logger = this.getLogger(namespace, {pid});
    logger.sendLog(LogLevel.Critical, message);
  }

  dispose(namespace: SupportLogNamespace) {
    this.getLogger(namespace).dispose();
  }

  setGlobalLogLevel(level: LogLevel) {
    this.loggerManage.setGlobalLogLevel(level);
  }

  getGlobalLogLevel() {
    this.loggerManage.getGlobalLogLevel();
  }

  disposeAll() {
    this.loggerManage.dispose();
  }

  private getLogger(namespace: SupportLogNamespace, options?: SimpleLogServiceOptions) {
    const logger = this.loggerManage.getLogger(namespace, Object.assign({}, options));
    return logger;
  }
}

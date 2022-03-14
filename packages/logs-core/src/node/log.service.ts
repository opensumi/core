import os from 'os';
import path from 'path';
import process from 'process';

import spdlog from 'spdlog';

import { Injectable, Autowired } from '@opensumi/di';
import { RPCService } from '@opensumi/ide-connection';

import {
  ILogService,
  ILogServiceOptions,
  BaseLogServiceOptions,
  LogLevel,
  SupportLogNamespace,
  ILogServiceManager,
  format,
  ILogServiceForClient,
  DebugLog,
  IBaseLogService,
} from '../common/';

export const DEFAULT_LOG_FOLDER = path.join(os.homedir(), '.sumi/logs/');

type SpdLogger = spdlog.RotatingLogger;
interface ILog {
  level: LogLevel;
  message: string;
}

export const LogLevelMessageMap = {
  [LogLevel.Verbose]: 'VERBOSE',
  [LogLevel.Debug]: 'DEBUG',
  [LogLevel.Info]: 'INFO',
  [LogLevel.Warning]: 'WARNING',
  [LogLevel.Error]: 'ERROR',
  [LogLevel.Critical]: 'CRITICAL',
};

export class BaseLogService implements IBaseLogService {
  protected namespace: string;
  protected logger: SpdLogger | undefined;
  protected buffer: ILog[] = [];
  protected pid: number;
  protected debugLog: DebugLog;
  protected spdLogLoggerPromise: Promise<SpdLogger | null> | undefined;
  protected logDir: string;
  protected logLevel: LogLevel;

  constructor(options: BaseLogServiceOptions) {
    this.init(options);
    this.debugLog = new DebugLog(this.namespace);
    this.spdLogLoggerPromise = this.createSpdLogLoggerPromise(this.namespace, this.logDir);
  }

  protected init(options: BaseLogServiceOptions) {
    this.namespace = options.namespace || SupportLogNamespace.OTHER;
    this.pid = options.pid || process.pid;
    this.logDir = options.logDir || DEFAULT_LOG_FOLDER;
    this.logLevel = options.logLevel || LogLevel.Info;
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

  async drop() {
    await this.spdLogLoggerPromise;
    if (this.logger) {
      this.logger.drop();
    }
  }

  async flush() {
    await this.spdLogLoggerPromise;
    if (this.logger) {
      return this.logger.flush();
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
  }

  protected disposeLogger(): void {
    if (this.logger) {
      this.logger.drop();
      this.logger = undefined;
    }
  }

  protected async createSpdLogLoggerPromise(namespace: string, logsFolder: string): Promise<SpdLogger | null> {
    // Do not crash if spdlog cannot be loaded
    try {
      const _spdlog = require('spdlog');
      _spdlog.setAsyncMode(8192, 500);
      const logFilePath = path.join(logsFolder, `${namespace}.log`);
      return _spdlog
        .createRotatingLoggerAsync(namespace, logFilePath, 1024 * 1024 * 5, 6)
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
        })
        .catch((e) => {
          this.debugLog.error(e);
        });
    } catch (e) {
      this.debugLog.error(e);
    }
    return null;
  }

  /**
   * 日志行格式 `[年-月-日 时:分:秒:毫秒][级别][PID]` 比如：
   * [2019-08-15 14:32:19.207][INFO][50715] log message!!!
   * [年-月-日 时:分:秒:毫秒] 由 spdlog 提供
   */
  protected applyLogPreString(message: string, level) {
    const preString = `[${LogLevelMessageMap[level]}][${this.pid}] `;
    return preString + message;
  }

  protected doLog(logger: SpdLogger, level: LogLevel, message: string): void {
    if (!logger) {
      return;
    }
    switch (level) {
      case LogLevel.Verbose:
        return logger.trace(this.applyLogPreString(message, level));
      case LogLevel.Debug:
        return logger.debug(this.applyLogPreString(message, level));
      case LogLevel.Info:
        return logger.info(this.applyLogPreString(message, level));
      case LogLevel.Warning:
        return logger.warn(this.applyLogPreString(message, level));
      case LogLevel.Error:
        return logger.error(this.applyLogPreString(message, level));
      case LogLevel.Critical:
        return logger.critical(this.applyLogPreString(message, level));
      default:
        throw new Error('Invalid log level');
    }
  }

  protected showDebugLog(level: LogLevel, message: string): void {
    switch (level) {
      case LogLevel.Verbose:
        return this.debugLog.log(message);
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
      default:
        throw new Error('Invalid log level');
    }
  }
}

export class LogService extends BaseLogService implements ILogService {
  protected logServiceManager: ILogServiceManager;

  constructor(options: ILogServiceOptions) {
    super(options);
  }

  protected init(options: ILogServiceOptions) {
    this.logServiceManager = options.logServiceManager;
    this.namespace = options.namespace || SupportLogNamespace.OTHER;
    this.pid = options.pid || process.pid;
    this.logDir = this.logServiceManager.getLogFolder();
    this.logLevel = options.logLevel || LogLevel.Info;
  }

  setOptions(options: BaseLogServiceOptions) {
    if (options.pid) {
      this.pid = options.pid;
    }
    if (options.logLevel) {
      this.logLevel = options.logLevel;
    }
  }

  getLevel(): LogLevel {
    return this.logServiceManager.getGlobalLogLevel();
  }

  setLevel(level: LogLevel): void {
    this.logServiceManager.setGlobalLogLevel(level);
  }

  dispose() {
    super.dispose();
    this.logServiceManager.removeLogger(this.namespace as SupportLogNamespace);
  }
}

interface IRPCLogService {
  onDidLogLevelChanged(level: LogLevel): void;
}

@Injectable()
export class LogServiceForClient extends RPCService<IRPCLogService> implements ILogServiceForClient {
  @Autowired(ILogServiceManager)
  loggerManager: ILogServiceManager;

  constructor() {
    super();
    this.loggerManager.onDidChangeLogLevel((level) => {
      if (this.client) {
        this.client.onDidLogLevelChanged(level);
      }
    });
  }

  getLevel(namespace: SupportLogNamespace) {
    return this.getLogger(namespace).getLevel();
  }

  setLevel(namespace: SupportLogNamespace, level: LogLevel) {
    this.getLogger(namespace).setLevel(level);
  }

  verbose(namespace: SupportLogNamespace, message: string, pid?: number) {
    const logger = this.getLogger(namespace, { pid });
    logger.sendLog(LogLevel.Verbose, message);
  }

  debug(namespace: SupportLogNamespace, message: string, pid?: number) {
    const logger = this.getLogger(namespace, { pid });
    logger.sendLog(LogLevel.Debug, message);
  }

  log(namespace: SupportLogNamespace, message: string, pid?: number) {
    const logger = this.getLogger(namespace, { pid });
    logger.sendLog(LogLevel.Info, message);
  }

  warn(namespace: SupportLogNamespace, message: string, pid?: number) {
    const logger = this.getLogger(namespace, { pid });
    logger.sendLog(LogLevel.Warning, message);
  }

  error(namespace: SupportLogNamespace, message: string, pid?: number) {
    const logger = this.getLogger(namespace, { pid });
    logger.sendLog(LogLevel.Error, message);
  }

  critical(namespace: SupportLogNamespace, message: string, pid?: number) {
    const logger = this.getLogger(namespace, { pid });
    logger.sendLog(LogLevel.Critical, message);
  }

  dispose(namespace: SupportLogNamespace) {
    this.getLogger(namespace).dispose();
  }

  setGlobalLogLevel(level: LogLevel) {
    this.loggerManager.setGlobalLogLevel(level);
  }

  getGlobalLogLevel() {
    this.loggerManager.getGlobalLogLevel();
  }

  disposeAll() {
    this.loggerManager.dispose();
  }

  async getLogFolder() {
    return this.loggerManager.getLogFolder();
  }

  protected getLogger(namespace: SupportLogNamespace, options?: BaseLogServiceOptions) {
    const logger = this.loggerManager.getLogger(namespace, Object.assign({}, options));
    return logger;
  }
}

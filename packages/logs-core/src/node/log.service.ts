
import * as path from 'path';
import * as spdlog from 'spdlog';
import * as process from 'process';
import {
  ILogService,
  ILogServiceOptions,
  LogLevel,
  SupportLogNamespace,
  ILogServiceManage,
  format,
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
  readonly namespace: string;
  private logLevel: LogLevel;
  private logger: SpdLogger | undefined;
  private buffer: ILog[] = [];
  private spdLogLoggerPromise: Promise<SpdLogger | null> | undefined;
  private logServiceManage: ILogServiceManage;
  private pid: number;

  constructor(options: ILogServiceOptions) {
    this.namespace = options.namespace;
    this.logLevel = options.logLevel || LogLevel.Info;
    this.logServiceManage = options.logServiceManage;
    this.pid = options.pid || process.pid;
    this.spdLogLoggerPromise = this.createSpdLogLoggerPromise(
      this.namespace,
      options.logServiceManage.getLogFolder(),
    );
  }

  verbose(): void {
    if (this.getLevel() <= LogLevel.Verbose) {
      this.sendLog(LogLevel.Verbose, this.applyLogPreString(arguments));
    }
  }

  debug(): void {
    if (this.getLevel() <= LogLevel.Debug) {
      this.sendLog(LogLevel.Debug, this.applyLogPreString(arguments));
    }
  }

  log(): void {
    if (this.getLevel() <= LogLevel.Info) {
      this.sendLog(LogLevel.Info, this.applyLogPreString(arguments));
    }
  }

  warn(): void {
    if (this.getLevel() <= LogLevel.Warning) {
      this.sendLog(LogLevel.Warning, this.applyLogPreString(arguments));
    }
  }

  error(): void {
    if (this.getLevel() <= LogLevel.Error) {
      const arg = arguments[0];

      if (arg instanceof Error) {
        const array = Array.prototype.slice.call(arguments) as any[];
        array[0] = arg.stack;
        this.sendLog(LogLevel.Error, this.applyLogPreString(array));
      } else {
        this.sendLog(LogLevel.Error, this.applyLogPreString(arguments));
      }
    }
  }

  critical(): void {
    if (this.getLevel() <= LogLevel.Critical) {
      this.sendLog(LogLevel.Critical, this.applyLogPreString(arguments));
    }
  }

  getLevel(): LogLevel {
    return this.logLevel;
  }

  setLevel(level: LogLevel): void {
    this.logLevel = level;
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
   *
   * @private
   * @param {*} args
   * @returns
   * @memberof LogService
   */
  private applyLogPreString(args: any) {
    const preString = `[${LogLevelMessageMap[this.logLevel]}][${this.pid}] `;
    return preString + format(args);
  }

  private sendLog(level: LogLevel, message: string): void {
    if (this.logger) {
      this.doLog(this.logger, level, message);
    } else if (this.getLevel() <= level) {
      this.buffer.push({ level, message });
    }
  }

 private doLog(logger: SpdLogger, level: LogLevel, message: string): void {
    switch (level) {
      case LogLevel.Verbose: return logger.trace(message);
      case LogLevel.Debug: return logger.debug(message);
      case LogLevel.Info: return logger.info(message);
      case LogLevel.Warning: return logger.warn(message);
      case LogLevel.Error: return logger.error(message);
      case LogLevel.Critical: return logger.critical(message);
      default: throw new Error('Invalid log level');
    }
  }
}

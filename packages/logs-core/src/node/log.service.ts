
import * as path from 'path';
import * as spdlog from 'spdlog';
import * as process from 'process';
import { DebugLog } from '../common/debug';
import {
  ILogService,
  ILogServiceOptions,
  SimpleLogServiceOptions,
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
  private namespace: string;
  private logLevel: LogLevel;
  private logger: SpdLogger | undefined;
  private buffer: ILog[] = [];
  private spdLogLoggerPromise: Promise<SpdLogger | null> | undefined;
  private logServiceManage: ILogServiceManage;
  private pid: number;
  private debugLog: DebugLog;
  private isShowConsoleLog: boolean = false;

  constructor(options: ILogServiceOptions) {
    this.setOptions(options);

    this.logServiceManage = options.logServiceManage;
    this.spdLogLoggerPromise = this.createSpdLogLoggerPromise(
      this.namespace,
      options.logServiceManage.getLogFolder(),
    );
    this.debugLog = new DebugLog(this.namespace);
  }

  setOptions(options: SimpleLogServiceOptions) {
    this.namespace = options.namespace || SupportLogNamespace.OTHER;
    this.logLevel = options.logLevel || LogLevel.Info;
    this.isShowConsoleLog = options.isShowConsoleLog || true;
    this.pid = options.pid || process.pid;
  }

  setShowConsoleLog(isShow: boolean) {
    this.isShowConsoleLog = !!isShow;
  }

  verbose(): void {
    if (this.getLevel() <= LogLevel.Verbose) {
      this.sendLog(LogLevel.Verbose, arguments);
    }
  }

  debug(): void {
    if (this.getLevel() <= LogLevel.Debug) {
      this.sendLog(LogLevel.Debug, arguments);
    }
  }

  log(): void {
    console.log('this.getLevel()', this.getLevel());
    if (this.getLevel() <= LogLevel.Info) {
      this.sendLog(LogLevel.Info, arguments);
    }
  }

  warn(): void {
    if (this.getLevel() <= LogLevel.Warning) {
      this.sendLog(LogLevel.Warning, arguments);
    }
  }

  error(): void {
    if (this.getLevel() <= LogLevel.Error) {
      const arg = arguments[0];

      if (arg instanceof Error) {
        const array = Array.prototype.slice.call(arguments) as any[];
        array[0] = arg.stack;
        this.sendLog(LogLevel.Error, array);
      } else {
        this.sendLog(LogLevel.Error, arguments);
      }
    }
  }

  critical(): void {
    if (this.getLevel() <= LogLevel.Critical) {
      this.sendLog(LogLevel.Critical, arguments);
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
   */
  private applyLogPreString(message: string) {
    const preString = `[${LogLevelMessageMap[this.logLevel]}][${this.pid}] `;
    return preString + message;
  }

  private sendLog(level: LogLevel, args: any): void {
    const message = format(args);
    if (this.logger) {
      this.doLog(this.logger, level, message);
    } else if (this.getLevel() <= level) {
      this.buffer.push({ level, message });
    }
  }

  private doLog(logger: SpdLogger, level: LogLevel, message: string ): void {
    switch (level) {
      case LogLevel.Verbose:
        if (this.isShowConsoleLog) {
          this.debugLog.verbose(message);
        }
        return logger.trace(this.applyLogPreString(message));
      case LogLevel.Debug:
        if (this.isShowConsoleLog) {
          this.debugLog.debug(message);
        }
        return logger.debug(this.applyLogPreString(message));
      case LogLevel.Info:
        if (this.isShowConsoleLog) {
          this.debugLog.info(message);
        }
        return logger.info(this.applyLogPreString(message));
      case LogLevel.Warning:
        if (this.isShowConsoleLog) {
          this.debugLog.warn(message);
        }
        return logger.warn(this.applyLogPreString(message));
      case LogLevel.Error:
        if (this.isShowConsoleLog) {
           this.debugLog.error(message);
        }
        return logger.error(this.applyLogPreString(message));
      case LogLevel.Critical:
        if (this.isShowConsoleLog) {
          this.debugLog.error(message);
        }
        return logger.critical(this.applyLogPreString(message));
      default: throw new Error('Invalid log level');
    }
  }
}

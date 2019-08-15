
import * as path from 'path';
import * as spdlog from 'spdlog';
import {
  ILogService,
  ILogServiceOptions,
  LogLevel,
  SupportLogNamespace,
  ILogServiceManage,
} from '../common/';

type SpdLogger = spdlog.RotatingLogger;
interface ILog {
  level: LogLevel;
  message: string;
}

export class LogService implements ILogService {
  readonly namespace: string;
  private logLevel: LogLevel;
  private logger: SpdLogger | undefined;
  private buffer: ILog[] = [];
  private spdLogLoggerPromise: Promise<SpdLogger | null> | undefined;
  private logServiceManage: ILogServiceManage;

  constructor(options: ILogServiceOptions) {
    this.namespace = options.namespace;
    this.logLevel = options.logLevel || LogLevel.Info;
    this.logServiceManage = options.logServiceManage;
    this.spdLogLoggerPromise = this.createSpdLogLoggerPromise(
      this.namespace,
      options.logServiceManage.getLogFolder(),
    );
  }

  trace(): void {
    if (this.getLevel() <= LogLevel.Trace) {
      this.sendLog(LogLevel.Trace, this.format(arguments));
    }
  }

  debug(): void {
    if (this.getLevel() <= LogLevel.Debug) {
      this.sendLog(LogLevel.Debug, this.format(arguments));
    }
  }

  info(): void {
    if (this.getLevel() <= LogLevel.Info) {
      this.sendLog(LogLevel.Info, this.format(arguments));
    }
  }

  warn(): void {
    if (this.getLevel() <= LogLevel.Warning) {
      this.sendLog(LogLevel.Warning, this.format(arguments));
    }
  }

  error(): void {
    if (this.getLevel() <= LogLevel.Error) {
      const arg = arguments[0];

      if (arg instanceof Error) {
        const array = Array.prototype.slice.call(arguments) as any[];
        array[0] = arg.stack;
        this.sendLog(LogLevel.Error, this.format(array));
      } else {
        this.sendLog(LogLevel.Error, this.format(arguments));
      }
    }
  }

  critical(): void {
    if (this.getLevel() <= LogLevel.Critical) {
      this.sendLog(LogLevel.Critical, this.format(arguments));
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
            for (const { level, message } of this.buffer) {
              this.log(this.logger!, level, message);
            }
            this.buffer = [];
          }
        });
    } catch (e) {
      console.error(e);
    }
    return null;
  }

  private format(args: any): string {
    let result = '';

    for (let i = 0; i < args.length; i++) {
      let a = args[i];

      if (typeof a === 'object') {
        try {
          a = JSON.stringify(a);
        } catch (e) { }
      }

      result += (i > 0 ? ' ' : '') + a;
    }

    return result;
  }

  private sendLog(level: LogLevel, message: string): void {
    if (this.logger) {
      this.log(this.logger, level, message);
    } else if (this.getLevel() <= level) {
      this.buffer.push({ level, message });
    }
  }

 private log(logger: SpdLogger, level: LogLevel, message: string): void {
    console.log(level, message);

    switch (level) {
      case LogLevel.Trace: return logger.trace(message);
      case LogLevel.Debug: return logger.debug(message);
      case LogLevel.Info: return logger.info(message);
      case LogLevel.Warning: return logger.warn(message);
      case LogLevel.Error: return logger.error(message);
      case LogLevel.Critical: return logger.critical(message);
      default: throw new Error('Invalid log level');
    }
  }
}

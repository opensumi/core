import { Injector } from '@opensumi/di';
import { ILogService, IWatcherProcessLogger, LogLevel, SupportLogNamespace } from '@opensumi/ide-core-common/lib/log';
import { LogServiceManager } from '@opensumi/ide-logs/lib/node/log-manager';

export class WatcherProcessLogger implements IWatcherProcessLogger {
  private loggerManager: LogServiceManager;
  private logger: ILogService;

  constructor(private injector: Injector, private logDir: string, private logLevel: LogLevel) {
    this.loggerManager = this.injector.get(LogServiceManager, [
      {
        logLevel: this.logLevel,
        logDir: this.logDir,
      },
    ]);
    this.logger = this.loggerManager.getLogger(SupportLogNamespace.WatcherHost, {
      logLevel: this.logLevel,
      logDir: this.logDir,
    });
  }

  error(...args) {
    return this.logger.error(...args);
  }

  warn(...args) {
    return this.logger.warn(...args);
  }

  log(...args) {
    return this.logger.log(...args);
  }

  debug(...args) {
    return this.logger.debug(...args);
  }

  verbose(...args) {
    return this.logger.verbose(...args);
  }

  critical(...args) {
    return this.logger.critical(...args);
  }

  dispose() {
    return this.logger.dispose();
  }

  setOptions(options) {
    return this.logger.setOptions(options);
  }

  sendLog(level: LogLevel, message: string) {
    return this.logger.sendLog(level, message);
  }

  drop() {
    return this.logger.drop();
  }

  flush() {
    return this.logger.flush();
  }

  getLevel() {
    return this.logger.getLevel();
  }

  setLevel(level: LogLevel) {
    return this.logger.setLevel(level);
  }
}

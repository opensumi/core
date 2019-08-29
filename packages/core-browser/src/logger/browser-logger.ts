import { Injectable, Autowired } from '@ali/common-di';
import {
  ILoggerManagerClient,
  SupportLogNamespace,
  ILogServiceClient,
  LogLevel,
  ILogger,
} from '@ali/ide-core-common';

export { getLogger, ILogger } from '@ali/ide-core-common';

@Injectable()
export class Logger implements ILogServiceClient {

  @Autowired(ILoggerManagerClient)
  private LoggerManager: ILoggerManagerClient;
  private logger: ILogServiceClient = this.LoggerManager.getLogger(SupportLogNamespace.Browser);

  getLevel() {
    return this.getLevel();
  }

  setLevel(level: LogLevel) {
    return this.logger.setLevel(level);
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
}

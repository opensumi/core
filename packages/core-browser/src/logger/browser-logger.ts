import { Autowired, Injectable } from '@opensumi/di';
import { ILogServiceClient, ILoggerManagerClient, LogLevel, SupportLogNamespace } from '@opensumi/ide-core-common';

export { ILogger } from '@opensumi/ide-core-common';

class LoggerWrapper implements ILogServiceClient {
  protected logger: ILogServiceClient;

  setup(logger: ILogServiceClient) {
    this.logger = logger;
  }

  public getLevel() {
    return this.logger.getLevel();
  }

  public setLevel(level: LogLevel) {
    return this.logger.setLevel(level);
  }

  public error(...args) {
    return this.logger.error(...args);
  }

  public warn(...args) {
    return this.logger.warn(...args);
  }

  public log(...args) {
    return this.logger.log(...args);
  }
  public debug(...args) {
    return this.logger.debug(...args);
  }

  public verbose(...args) {
    return this.logger.verbose(...args);
  }

  public critical(...args) {
    return this.logger.critical(...args);
  }

  public dispose() {
    return this.logger.dispose();
  }
}

@Injectable()
export class Logger extends LoggerWrapper implements ILogServiceClient {
  @Autowired(ILoggerManagerClient)
  protected loggerManager: ILoggerManagerClient;

  constructor() {
    super();
    this.logger = this.loggerManager.getBrowserLogger(SupportLogNamespace.Browser);
  }

  public reportToServer() {
    this.logger.dispose();
    this.logger = this.loggerManager.getLogger(SupportLogNamespace.Browser);
  }
}

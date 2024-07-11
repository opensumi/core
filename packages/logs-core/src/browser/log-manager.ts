import { Autowired, Injectable } from '@opensumi/di';
import { Emitter } from '@opensumi/ide-core-common';

import {
  ILogServiceClient,
  ILogServiceForClient,
  ILoggerManagerClient,
  LogLevel,
  LogServiceForClientPath,
  SupportLogNamespace,
} from '../common';

import { LogServiceClient } from './log.service';

@Injectable()
export class LoggerManagerClient implements ILoggerManagerClient {
  protected readonly logLevelChangeEmitter = new Emitter<LogLevel>();
  @Autowired(LogServiceForClientPath)
  logServiceForClient: ILogServiceForClient;

  getLogger(namespace: SupportLogNamespace, pid?: number): ILogServiceClient {
    const logger = new LogServiceClient(namespace);
    logger.setup(this.logServiceForClient, pid);
    return logger;
  }

  /**
   * Logger that can used in non-server environment
   */
  getBrowserLogger(namespace: SupportLogNamespace): ILogServiceClient {
    return new LogServiceClient(namespace);
  }

  async getLogFolder() {
    return await this.logServiceForClient.getLogFolder();
  }

  async setGlobalLogLevel(level: LogLevel) {
    return await this.logServiceForClient.setGlobalLogLevel(level);
  }

  async getGlobalLogLevel() {
    return await this.logServiceForClient.getGlobalLogLevel();
  }

  async dispose() {
    this.logLevelChangeEmitter.dispose();
    return await this.logServiceForClient.disposeAll();
  }

  get onDidChangeLogLevel() {
    return this.logLevelChangeEmitter.event;
  }

  onDidLogLevelChanged(level: LogLevel) {
    this.logLevelChangeEmitter.fire(level);
  }
}

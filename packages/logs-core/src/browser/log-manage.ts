import { Injectable, Autowired } from '@opensumi/di';
import { Emitter } from '@opensumi/ide-core-common';

import {
  LogServiceForClientPath,
  ILogServiceForClient,
  SupportLogNamespace,
  LogLevel,
  ILoggerManagerClient,
  ILogServiceClient,
} from '../common/';

import { LogServiceClient } from './log.service';

@Injectable()
export class LoggerManagerClient implements ILoggerManagerClient {
  protected readonly logLevelChangeEmitter = new Emitter<LogLevel>();
  @Autowired(LogServiceForClientPath)
  logServiceForClient: ILogServiceForClient;

  getLogger(namespace: SupportLogNamespace, pid?: number): ILogServiceClient {
    return new LogServiceClient(namespace, this.logServiceForClient, pid);
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

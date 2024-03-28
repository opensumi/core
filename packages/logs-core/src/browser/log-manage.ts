import { Autowired, Injectable } from '@opensumi/di';
import { Emitter } from '@opensumi/ide-core-common';

import {
  ILogServiceClient,
  ILogServiceForClient,
  ILoggerManagerClient,
  LogLevel,
  LogServiceForClientPath,
  SupportLogNamespace,
} from '../common/';

import { LogServiceClient } from './log.service';
import { LogServiceClientLocal } from './log.service.local';

@Injectable()
export class LoggerManagerClient implements ILoggerManagerClient {
  protected readonly logLevelChangeEmitter = new Emitter<LogLevel>();
  @Autowired(LogServiceForClientPath)
  logServiceForClient: ILogServiceForClient;

  protected connectedToServer = false;
  enableRemoteLogger(connected: boolean) {
    this.connectedToServer = connected;
  }

  getLogger(namespace: SupportLogNamespace, pid?: number): ILogServiceClient {
    if (!this.connectedToServer) {
      return new LogServiceClientLocal(namespace, pid);
    }

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

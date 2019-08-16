import { Injectable } from '@ali/common-di';
import { BasicModule } from '@ali/ide-core-common';
import { LogServiceManage } from './log-manage';
import {
  LogServiceForClientPath,
  ILogServiceForClient,
  SupportLogNamespace,
  LogLevel,
} from '../common/';

export const LoggerManage = new LogServiceManage();
export * from '../common/';

@Injectable()
export class LogServiceForClient implements ILogServiceForClient {
  getLevel(namespace: SupportLogNamespace) {
    return this.getLogger(namespace).getLevel();
  }

  setLevel(namespace: SupportLogNamespace, level: LogLevel) {
    this.getLogger(namespace).setLevel(level);
  }

  verbose(namespace: SupportLogNamespace,  message: string) {
    this.getLogger(namespace).verbose(message);
  }

  debug(namespace: SupportLogNamespace,  message: string) {
    this.getLogger(namespace).debug(message);
  }

  log(namespace: SupportLogNamespace,  message: string) {
    this.getLogger(namespace).log(message);
  }

  warn(namespace: SupportLogNamespace,  message: string) {
    this.getLogger(namespace).warn(message);
  }

  error(namespace: SupportLogNamespace,  message: string) {
    this.getLogger(namespace).error(message);
  }

  critical(namespace: SupportLogNamespace,  message: string) {
    this.getLogger(namespace).critical(message);
  }

  dispose(namespace: SupportLogNamespace) {
    this.getLogger(namespace).dispose();
  }

  setGlobalLogLevel(level: LogLevel) {
    LoggerManage.setGlobalLogLevel(level);
  }

  getGlobalLogLevel() {
    return LoggerManage.getGlobalLogLevel();
  }

  private getLogger(namespace: SupportLogNamespace) {
    return LoggerManage.getLogger(namespace);
  }
}

@Injectable()
export class LogServiceModule extends BasicModule {
  providers = [{
    token: ILogServiceForClient,
    useClass: LogServiceForClient,
  }];

  backServices = [
    {
      servicePath: LogServiceForClientPath,
      token: ILogServiceForClient,
    },
  ];
}

// 每次启动时执行清理
LoggerManage.cleanOldLogs();

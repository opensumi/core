import { Injectable } from '@ali/common-di';
import { BasicModule } from '@ali/ide-core-common';
import { LogServiceManage } from './log-manage';
import {
  LogServiceForClientPath,
  ILogServiceForClient,
  SupportLogNamespace,
  LogLevel,
  SimpleLogServiceOptions,
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

  verbose(namespace: SupportLogNamespace,  message: string, pid?: number) {
    this.getLogger(namespace, {pid}).verbose(message);
  }

  debug(namespace: SupportLogNamespace,  message: string, pid?: number) {
    this.getLogger(namespace, {pid}).debug(message);
  }

  log(namespace: SupportLogNamespace,  message: string, pid?: number) {
    this.getLogger(namespace, {pid}).log(message);
  }

  warn(namespace: SupportLogNamespace,  message: string, pid?: number) {
    this.getLogger(namespace, {pid}).warn(message);
  }

  error(namespace: SupportLogNamespace,  message: string, pid?: number) {
    this.getLogger(namespace, {pid}).error(message);
  }

  critical(namespace: SupportLogNamespace,  message: string, pid?: number) {
    this.getLogger(namespace, {pid}).critical(message);
  }

  dispose(namespace: SupportLogNamespace) {
    this.getLogger(namespace).dispose();
  }

  setGlobalLogLevel(level: LogLevel) {
    LoggerManage.setGlobalLogLevel(level);
  }

  getGlobalLogLevel() {
    LoggerManage.getGlobalLogLevel();
  }

  disposeAll() {
    LoggerManage.dispose();
  }

  private getLogger(namespace: SupportLogNamespace, options?: SimpleLogServiceOptions) {
    return LoggerManage.getLogger(namespace, Object.assign({
      isShowConsoleLog: false,
    }, options));
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

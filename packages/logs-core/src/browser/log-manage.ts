import { Injectable, Autowired } from '@ali/common-di';
import { LogServiceClient } from './log.service';
import {
  LogServiceForClientPath,
  ILogServiceForClient,
  SupportLogNamespace,
  LogLevel,
  ILoggerManagerClient,
  ILogServiceClient,
} from '../common/';

@Injectable()
export class LoggerManagerClient implements ILoggerManagerClient {
  @Autowired(LogServiceForClientPath)
  logServiceForClient: ILogServiceForClient;

  getLogger(namespace: SupportLogNamespace, pid?: number): ILogServiceClient {
    return new LogServiceClient(namespace, this.logServiceForClient, pid);
  }

  async setGlobalLogLevel(level: LogLevel) {
    return await this.logServiceForClient.setGlobalLogLevel(level);
  }

  async getGlobalLogLevel() {
    return await this.logServiceForClient.getGlobalLogLevel();
  }

  async dispose() {
    return await this.logServiceForClient.disposeAll();
  }

}

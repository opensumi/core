import { Injectable, Autowired } from '@ali/common-di';
import { LogServiceClient } from './log.service';
import {
  LogServiceForClientPath,
  ILogServiceForClient,
  SupportLogNamespace,
} from '../common/';

@Injectable()
export class LoggerManage {
  @Autowired(LogServiceForClientPath)
  logServiceForClient: ILogServiceForClient;

  getLogger(namespace: SupportLogNamespace): LogServiceClient {
    return new LogServiceClient(namespace, this.logServiceForClient);
  }
}

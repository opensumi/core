import { Provider, Injectable } from '@ali/common-di';
import { BasicModule } from '@ali/ide-core-common';
import { LogServiceForClientPath } from '../common/';
import { LoggerManage } from './log-manage';

export { LoggerManage } from './log-manage';
export * from '../common/';
export { LogServiceClient } from './log.service';

@Injectable()
export class LogsModule extends BasicModule {
  providers: Provider[] = [];

  backServices = [{
    servicePath: LogServiceForClientPath,
    clientToken: LoggerManage,
  }];
}

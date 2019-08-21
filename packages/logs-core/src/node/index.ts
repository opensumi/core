import { Injectable, Autowired } from '@ali/common-di';
import { BasicModule } from '@ali/ide-core-common';
import { LogServiceManage } from './log-manage';
import {
  LogServiceForClientPath,
  ILogServiceForClient,
  ILogServiceManage,
} from '../common/';
import { LogServiceForClient } from './log.service';

export * from '../common/';

@Injectable()
export class LogServiceModule extends BasicModule {
  providers = [{
    token: ILogServiceForClient,
    useClass: LogServiceForClient,
  }, {
    token: ILogServiceManage,
    useClass: LogServiceManage,
  }];

  backServices = [
    {
      servicePath: LogServiceForClientPath,
      token: ILogServiceForClient,
    },
  ];
}

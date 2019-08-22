import { Injectable, Autowired } from '@ali/common-di';
import { NodeModule } from '@ali/ide-core-node';
import { LogServiceManage } from './log-manage';
import {
  LogServiceForClientPath,
  ILogServiceForClient,
  ILogServiceManage,
} from '../common/';
import { LogServiceForClient } from './log.service';

export * from '../common/';

@Injectable()
export class LogServiceModule extends NodeModule {
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

import { Injectable } from '@opensumi/di';
import { NodeModule } from '@opensumi/ide-core-node';
import { LogServiceManager } from './log-manager';
import {
  LogServiceForClientPath,
  ILogServiceForClient,
  ILogServiceManager,
} from '../common/';
import { LogServiceForClient } from './log.service';

export * from '../common/';

@Injectable()
export class LogServiceModule extends NodeModule {
  providers = [{
    token: ILogServiceForClient,
    useClass: LogServiceForClient,
  }, {
    token: ILogServiceManager,
    useClass: LogServiceManager,
  }];

  backServices = [
    {
      servicePath: LogServiceForClientPath,
      token: ILogServiceForClient,
    },
  ];
}

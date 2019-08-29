import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { LogServiceForClientPath, ILoggerManagerClient } from '../common/';
import { LoggerManagerClient } from './log-manage';

export * from '../common/';
export { LogServiceClient } from './log.service';

@Injectable()
export class LogModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: ILoggerManagerClient,
      useClass: LoggerManagerClient,
    },
  ];

  backServices = [{
    servicePath: LogServiceForClientPath,
    clientToken: ILoggerManagerClient,
  }];
}

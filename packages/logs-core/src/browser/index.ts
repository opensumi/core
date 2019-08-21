import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { LogServiceForClientPath, ILoggerManageClient } from '../common/';
import { LoggerManageClient } from './log-manage';

export * from '../common/';
export { LogServiceClient } from './log.service';

@Injectable()
export class LogModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: ILoggerManageClient,
      useClass: LoggerManageClient,
    },
  ];

  backServices = [{
    servicePath: LogServiceForClientPath,
    clientToken: ILoggerManageClient,
  }];
}

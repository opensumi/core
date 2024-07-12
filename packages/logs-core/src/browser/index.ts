import { Injectable, Provider } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';

import { ILoggerManagerClient, LogServiceForClientPath } from '../common/';

import { LoggerManagerClient } from './log-manager';

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

  backServices = [
    {
      servicePath: LogServiceForClientPath,
      clientToken: ILoggerManagerClient,
    },
  ];
}

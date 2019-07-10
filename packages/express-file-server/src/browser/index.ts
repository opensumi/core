import { Provider, Injectable } from '@ali/common-di';
import { ExpressFileServerContribution } from './file-server.contribution';
import { BrowserModule } from '@ali/ide-core-browser';

@Injectable()
export class ExpressFileServerModule extends BrowserModule {
  providers: Provider[] = [
    ExpressFileServerContribution,
  ];
}

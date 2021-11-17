import { Provider, Injectable } from '@ide-framework/common-di';
import { ExpressFileServerContribution } from './file-server.contribution';
import { BrowserModule } from '@ide-framework/ide-core-browser';

@Injectable()
export class ExpressFileServerModule extends BrowserModule {
  providers: Provider[] = [
    ExpressFileServerContribution,
  ];
}

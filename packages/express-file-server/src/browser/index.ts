import { Provider, Injectable } from '@opensumi/common-di';
import { ExpressFileServerContribution } from './file-server.contribution';
import { BrowserModule } from '@opensumi/ide-core-browser';

@Injectable()
export class ExpressFileServerModule extends BrowserModule {
  providers: Provider[] = [
    ExpressFileServerContribution,
  ];
}

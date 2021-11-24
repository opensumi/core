import { Provider, Injectable } from '@opensumi/di';
import { ExpressFileServerContribution } from './file-server.contribution';
import { BrowserModule } from '@opensumi/ide-core-browser';

@Injectable()
export class ExpressFileServerModule extends BrowserModule {
  providers: Provider[] = [
    ExpressFileServerContribution,
  ];
}

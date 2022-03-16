import { Provider, Injectable } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';

import { ExpressFileServerContribution } from './file-server.contribution';

@Injectable()
export class ExpressFileServerModule extends BrowserModule {
  providers: Provider[] = [ExpressFileServerContribution];
}

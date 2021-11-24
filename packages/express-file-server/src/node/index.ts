import { Provider, Injectable } from '@opensumi/common-di';
import { NodeModule } from '@opensumi/ide-core-node';
import { ExpressFileServerContribution } from './express-file-server.contribution';

@Injectable()
export class ExpressFileServerModule extends NodeModule {
  providers: Provider[] = [
    ExpressFileServerContribution,
  ];
}

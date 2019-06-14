import { Provider, Injectable } from '@ali/common-di';
import { NodeModule } from '@ali/ide-core-node';
import { ExpressFileServerContribution } from './express-file-server.contribution';

@Injectable()
export class ExpressFileServerModule extends NodeModule {
  providers: Provider[] = [
    ExpressFileServerContribution,
  ];
}

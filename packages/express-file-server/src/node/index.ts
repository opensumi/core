import { Provider, Injectable } from '@ide-framework/common-di';
import { NodeModule } from '@ide-framework/ide-core-node';
import { ExpressFileServerContribution } from './express-file-server.contribution';

@Injectable()
export class ExpressFileServerModule extends NodeModule {
  providers: Provider[] = [
    ExpressFileServerContribution,
  ];
}

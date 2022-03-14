import { Provider, Injectable } from '@opensumi/di';
import { NodeModule } from '@opensumi/ide-core-node';

import { ITopbarNodeServer, TopbarNodeServerPath } from '../common';

import { TopbarNodeServer } from './topbar-node-server';

@Injectable()
export class TopBarModule extends NodeModule {
  providers: Provider[] = [
    {
      token: ITopbarNodeServer,
      useClass: TopbarNodeServer,
    },
  ];

  backServices = [
    {
      token: ITopbarNodeServer,
      servicePath: TopbarNodeServerPath,
    },
  ];
}

import { Injectable, Provider } from '@opensumi/di';
import { NodeModule } from '@opensumi/ide-core-node';

import { IYWebsocketServer } from '../common';

import { CollaborationNodeContribution } from './collaboration.contribution';
import { YWebsocketServerImpl } from './y-websocket-server';

@Injectable()
export class CollaborationModule extends NodeModule {
  providers: Provider[] = [
    CollaborationNodeContribution,
    {
      token: IYWebsocketServer,
      useClass: YWebsocketServerImpl,
    },
  ];
}

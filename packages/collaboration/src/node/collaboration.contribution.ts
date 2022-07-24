import { Autowired } from '@opensumi/di';
import { Domain, INodeLogger, ServerAppContribution } from '@opensumi/ide-core-node';

import { IYWebsocketServer } from '../common';

import { YWebsocketServerImpl } from './y-websocket-server';

@Domain(ServerAppContribution)
export class CollaborationNodeContribution implements ServerAppContribution {
  @Autowired(IYWebsocketServer)
  private server: YWebsocketServerImpl;

  @Autowired(INodeLogger)
  private logger: INodeLogger;

  initialize() {
    this.server.initialize();
  }

  onStop() {
    this.server.dispose();
  }
}

import net from 'net';

import { ILogger } from '../common';
import { NetSocketConnection } from '../common/connection';
import { BaseCommonChannelHandler, CommonChannelPathHandler } from '../common/server-handler';

/**
 * Channel Handler for electron backend
 */
export class ElectronChannelHandler extends BaseCommonChannelHandler {
  constructor(
    private server: net.Server,
    protected commonChannelPathHandler: CommonChannelPathHandler,
    logger: ILogger = console,
  ) {
    super('electron-channel-handler', commonChannelPathHandler, logger);
  }

  doHeartbeat(connection: any): void {
    // do nothing
  }

  listen() {
    this.logger.log('init Common Channel Handler');
    this.server.on('connection', (connection: net.Socket) => {
      const netConnection = new NetSocketConnection(connection);
      this.receiveConnection(netConnection);
    });
  }
}

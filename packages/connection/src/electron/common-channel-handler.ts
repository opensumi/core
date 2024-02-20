import net from 'net';

import { Injector } from '@opensumi/di';

import { ILogger } from '../common';
import { NetSocketConnection } from '../common/connection';
import { BaseCommonChannelHandler } from '../common/server-handler';

/**
 * Channel Handler for electron backend
 */
export class CommonChannelHandler4Electron extends BaseCommonChannelHandler {
  constructor(private server: net.Server, private injector: Injector, logger: ILogger = console) {
    super('common-channel-4-electron', logger);
  }

  listen() {
    this.logger.log('init Common Channel Handler');
    this.server.on('connection', (connection: net.Socket) => {
      const netConnection = new NetSocketConnection(connection);
      this.receiveConnection(netConnection);
    });
  }
}

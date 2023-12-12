import { MessageChannel } from 'worker_threads';

import { NodeMessagePortDriver } from '@opensumi/ide-connection/lib/common/drivers/node-message-port';

import { BinaryConnection } from '../../../src/common/sumi-rpc/connection';

export function createConnectionPair() {
  const channel = new MessageChannel();

  const { port1, port2 } = channel;

  const connection1 = new BinaryConnection(new NodeMessagePortDriver(port1));

  const connection2 = new BinaryConnection(new NodeMessagePortDriver(port2));

  return {
    connection1,
    connection2,
    port1,
    port2,
    close() {
      port1.close();
      port2.close();
    },
  };
}

import { MessageChannel } from 'worker_threads';

import { NodeMessagePortConnection } from '../../../src/common/connection/drivers/node-message-port';
import { Connection } from '../../../src/common/rpc/connection';

export function createConnectionPair() {
  const channel = new MessageChannel();

  const { port1, port2 } = channel;

  const connection1 = new Connection(new NodeMessagePortConnection(port1));

  const connection2 = new Connection(new NodeMessagePortConnection(port2));

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

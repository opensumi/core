import { MessageChannel } from 'worker_threads';

import { BinaryConnection } from '../../../src/common/binary-connection';

export function createFuryConnectionPair() {
  const channel = new MessageChannel();

  const { port1, port2 } = channel;

  const connection1 = new BinaryConnection({
    onmessage(cb) {
      channel.port1.on('message', cb);
    },
    send(data) {
      channel.port1.postMessage(data);
    },
  });

  const connection2 = new BinaryConnection({
    onmessage(cb) {
      channel.port2.on('message', cb);
    },
    send(data) {
      channel.port2.postMessage(data);
    },
  });

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

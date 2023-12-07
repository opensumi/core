import net from 'net';

import { RPCServiceCenter, initRPCService } from '@opensumi/ide-connection';
import { RPCProtocol } from '@opensumi/ide-connection/lib/common/rpcProtocol';
import { createSocketChannel } from '@opensumi/ide-connection/lib/node';

export async function initMockRPCProtocol(client): Promise<RPCProtocol> {
  const extCenter = new RPCServiceCenter();
  const { getRPCService } = initRPCService(extCenter);
  const extConnection = net.createConnection('/tmp/test.sock');

  const channel = createSocketChannel(extConnection);
  extCenter.setConnection(channel.createMessageConnection(), channel.createBinaryConnection());

  const service = getRPCService('ExtProtocol');
  service.on('onMessage', (msg) => {
    // console.log('service onmessage', msg);
  });
  const extProtocol = new RPCProtocol({
    onMessage: client.onMessage,
    send: client.send,
  });

  return extProtocol;
}

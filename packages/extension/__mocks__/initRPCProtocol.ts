import net from 'net';

import { RPCServiceCenter, WSChannel, initRPCService } from '@opensumi/ide-connection';
import { RPCProtocol } from '@opensumi/ide-connection/lib/common/ext-rpc-protocol';

import { NetSocketConnection } from '@opensumi/ide-connection/lib/common/connection';

export async function initMockRPCProtocol(client): Promise<RPCProtocol> {
  const extCenter = new RPCServiceCenter();
  const { getRPCService } = initRPCService(extCenter);
  const extConnection = net.createConnection('/tmp/test.sock');
  const channel = WSChannel.forClient(new NetSocketConnection(extConnection), {
    id: 'mock',
    tag: 'mock',
  });

  extCenter.setConnection(channel.createMessageConnection());

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

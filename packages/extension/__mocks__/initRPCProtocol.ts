import net from 'net';

import { RPCServiceCenter, initRPCService } from '@opensumi/ide-connection';
import { RPCProtocol } from '@opensumi/ide-connection/lib/common/rpcProtocol';
import { createSocketConnection } from '@opensumi/ide-connection/lib/node';
import { argv } from '@opensumi/ide-core-common/lib/node/cli';

import { KT_PROCESS_SOCK_OPTION_KEY } from '../src/common';

export async function initMockRPCProtocol(client): Promise<RPCProtocol> {
  const extCenter = new RPCServiceCenter();
  const { getRPCService } = initRPCService(extCenter);
  const extConnection = net.createConnection('/tmp/test.sock');

  extCenter.setConnection(createSocketConnection(extConnection));

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

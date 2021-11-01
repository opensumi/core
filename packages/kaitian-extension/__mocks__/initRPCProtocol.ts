import net from 'net';
import { RPCProtocol } from '@ali/ide-connection/lib/common/rpcProtocol';
import { createSocketConnection, RPCServiceCenter, initRPCService } from '@ali/ide-connection';

import { KT_PROCESS_SOCK_OPTION_KEY } from '../src/common';

const argv = require('yargs').argv;

export async function initMockRPCProtocol(
  client,
): Promise<RPCProtocol> {
  const extCenter = new RPCServiceCenter();
  const { getRPCService } = initRPCService(extCenter);
  const extConnection = net.createConnection(JSON.parse(argv[KT_PROCESS_SOCK_OPTION_KEY] || '{}'));

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

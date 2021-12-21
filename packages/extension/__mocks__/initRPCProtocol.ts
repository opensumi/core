import net from 'net';
import { RPCProtocol } from '@opensumi/ide-connection/lib/common/rpcProtocol';
import { createSocketConnection, RPCServiceCenter, initRPCService } from '@opensumi/ide-connection';

import { KT_PROCESS_SOCK_OPTION_KEY } from '../src/common';

const argv = require('yargs').argv;

export async function initMockRPCProtocol(client): Promise<RPCProtocol> {
  const extCenter = new RPCServiceCenter();
  const { getRPCService } = initRPCService(extCenter);
  const extConnection = net.createConnection(JSON.parse(argv[KT_PROCESS_SOCK_OPTION_KEY] || '{}'));

  extCenter.setConnection(createSocketConnection(extConnection));

  const service = getRPCService('ExtProtocol');
  service.on('onMessage', () => {
  });
  const extProtocol = new RPCProtocol({
    onMessage: client.onMessage,
    send: client.send,
  });

  return extProtocol;
}

import * as net from 'net';
import { RPCProtocol } from '@ali/ide-connection/lib/common/rpcProtocol';
import { createSocketConnection, RPCServiceCenter, initRPCService } from '@ali/ide-connection';
const argv = require('yargs').argv;

export async function initMockRPCProtocol(
  client,
): Promise<RPCProtocol> {
  const extCenter = new RPCServiceCenter();
  const { getRPCService } = initRPCService(extCenter);
  const extConnection = net.createConnection(argv['kt-process-sockpath']);

  extCenter.setConnection(createSocketConnection(extConnection));

  const service = getRPCService('ExtProtocol');
  service.on('onMessage', (msg) => {
    console.log('service onmessage', msg);
  });
  const extProtocol = new RPCProtocol({
    onMessage: client.onMessage,
    send: client.send,
  });

  return extProtocol;
}

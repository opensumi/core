import { RPCServiceCenter, initRPCService } from '@opensumi/ide-connection';
import { RPCProtocol } from '@opensumi/ide-connection/lib/common/ext-rpc-protocol';

export async function initMockRPCProtocol(client): Promise<RPCProtocol> {
  const extCenter = new RPCServiceCenter();
  const { getRPCService } = initRPCService(extCenter);

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

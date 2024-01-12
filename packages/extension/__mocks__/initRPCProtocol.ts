import { RPCServiceCenter, initRPCService } from '@opensumi/ide-connection';
import { RPCProtocol } from '@opensumi/ide-connection/lib/common/ext-rpc-protocol';
import { Emitter } from '@opensumi/ide-core-common';

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

export function createMockPairRPCProtocol() {
  const emitterA = new Emitter<any>();
  const emitterB = new Emitter<any>();

  const mockClientA = {
    send: (msg) => emitterB.fire(msg),
    onMessage: emitterA.event,
  };
  const mockClientB = {
    send: (msg) => emitterA.fire(msg),
    onMessage: emitterB.event,
  };

  const rpcProtocolExt = new RPCProtocol(mockClientA);
  const rpcProtocolMain = new RPCProtocol(mockClientB);
  return {
    rpcProtocolExt,
    rpcProtocolMain,
  };
}

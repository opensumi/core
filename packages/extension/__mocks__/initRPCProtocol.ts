import { RPCServiceCenter, initRPCService } from '@opensumi/ide-connection';
import { SimpleConnection } from '@opensumi/ide-connection/lib/common/connection/drivers/simple';
import { IRPCProtocol, SumiConnectionMultiplexer } from '@opensumi/ide-connection/lib/common/rpc/multiplexer';
import { SumiConnection } from '@opensumi/ide-connection/lib/common/rpc/connection';
import { Emitter } from '@opensumi/ide-core-common';

export async function initMockRPCProtocol(client): Promise<SumiConnectionMultiplexer> {
  const extProtocol = new SumiConnectionMultiplexer(
    new SimpleConnection({
      onMessage: client.onMessage,
      send: client.send,
    }),
  );

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

  const rpcProtocolExt = new SumiConnectionMultiplexer(new SimpleConnection(mockClientA));
  const rpcProtocolMain = new SumiConnectionMultiplexer(new SimpleConnection(mockClientB));
  return {
    rpcProtocolExt,
    rpcProtocolMain,
  };
}

export const mockMultiplexerFactory = () => {
  const map = new Map();

  const rpcProtocol: IRPCProtocol = {
    getProxy: (key) => map.get(key),
    set: (key, value) => {
      map.set(key, value);
      return value;
    },
    get: (r) => map.get(r),

    dispose: () => {
      map.clear();
    },
  };
  return rpcProtocol;
};

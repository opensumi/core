import { MessageChannel, MessagePort } from 'worker_threads';

import { Type } from '@furyjs/fury';

import { ProxyLegacy, WSChannel } from '@opensumi/ide-connection';
import { ServiceRunner } from '@opensumi/ide-connection/lib/common/proxy/runner';
import { ProxySumi } from '@opensumi/ide-connection/lib/common/proxy/sumi';
import { ProtocolRepository } from '@opensumi/ide-connection/lib/common/rpc/protocol-repository';

import { NodeMessagePortConnection } from '../../../src/common/connection/drivers/node-message-port';
import { Connection } from '../../../src/common/rpc/connection';

export function createConnectionPair() {
  const channel = new MessageChannel();

  const { port1, port2 } = channel;

  const connection1 = new Connection(new NodeMessagePortConnection(port1));
  const connection2 = new Connection(new NodeMessagePortConnection(port2));

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

export interface IConnectionPair {
  connection1: any;
  connection2: any;
  port1: MessagePort;
  port2: MessagePort;
  close(): void;
}

export function createMessageConnectionPair() {
  const channel = new MessageChannel();

  const { port1, port2 } = channel;

  const channel1 = WSChannel.forClient(new NodeMessagePortConnection(port1), {
    id: '1',
  });
  const channel2 = WSChannel.forClient(new NodeMessagePortConnection(port2), {
    id: '2',
  });

  return {
    connection1: channel1.createMessageConnection(),
    connection2: channel2.createMessageConnection(),
    port1,
    port2,
    close() {
      port1.close();
      port2.close();
    },
  };
}

export function createSumiRPCClientPair(pair: ReturnType<typeof createConnectionPair>) {
  const protocols = {
    shortUrl: {
      protocol: {
        method: 'shortUrl',
        request: [
          {
            name: 'url',
            type: Type.string(),
          },
        ],
        response: {
          type: Type.string(),
        },
      },
    },
    returnUndefined: {
      protocol: {
        method: 'returnUndefined',
        request: [],
        response: {
          type: Type.any(),
        },
      },
    },
    add: {
      protocol: {
        method: 'add',
        request: [
          {
            name: 'a',
            type: Type.uint32(),
          },
          {
            name: 'b',
            type: Type.uint32(),
          },
        ],
        response: {
          type: Type.uint32(),
        },
      },
    },
  };

  const repo = new ProtocolRepository();

  repo.loadProtocolMethod(protocols.shortUrl.protocol);
  repo.loadProtocolMethod(protocols.returnUndefined.protocol);
  repo.loadProtocolMethod(protocols.add.protocol);

  pair.connection1.setProtocolRepository(repo);
  pair.connection2.setProtocolRepository(repo);

  const serviceRunner = new ServiceRunner();
  serviceRunner.registerService({
    shortUrl: (url: string) => url.slice(0, 10),
    returnUndefined: () => undefined,
  });

  const client1 = new ProxySumi(serviceRunner);

  client1.listen(pair.connection1);
  const invoker1 = client1.getInvokeProxy();

  const serviceRunner2 = new ServiceRunner();
  serviceRunner2.registerService({
    add: (a: number, b: number) => a + b,
  });

  const client2 = new ProxySumi(serviceRunner2);

  client2.listen(pair.connection2);

  const invoker2 = client2.getInvokeProxy();

  return {
    repo,
    client1,
    client2,
    invoker1,
    invoker2,
  };
}

export function createLegacyRPCClientPair(pair: ReturnType<typeof createMessageConnectionPair>) {
  const serviceRunner = new ServiceRunner();
  serviceRunner.registerService({
    shortUrl: (url: string) => url.slice(0, 10),
    returnUndefined: () => undefined,
  });

  const client1 = new ProxyLegacy(serviceRunner);
  client1.listen(pair.connection1);
  const invoker1 = client1.getInvokeProxy();

  const serviceRunner2 = new ServiceRunner();
  serviceRunner2.registerService({
    add: (a: number, b: number) => a + b,
  });

  const client2 = new ProxyLegacy(serviceRunner2);

  client2.listen(pair.connection2);

  const invoker2 = client2.getInvokeProxy();

  return {
    client1,
    client2,
    invoker1,
    invoker2,
  };
}

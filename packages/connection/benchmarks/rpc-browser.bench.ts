import { Type } from '@furyjs/fury';
/* eslint-disable no-console */
// @ts-ignore
import { Bench } from 'tinybench';

import { MessagePortConnection } from '../src/common/connection/drivers/message-port';
import { SumiConnection } from '../src/common/rpc/connection';
import { ProtocolRepository } from '../src/common/rpc/protocol-repository';
import { ServiceRegistry } from '../src/common/rpc-service/proxy/registry';
import { ProxySumi } from '../src/common/rpc-service/proxy/sumi';

const bench = new Bench({
  time: 2000,
});

const buffer = new Uint8Array(1024 * 1024);
for (let i = 0; i < buffer.length; ++i) {
  buffer[i] = Math.floor(Math.random() * 256);
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
    getContent: {
      protocol: {
        method: 'getContent',
        request: [],
        response: {
          type: Type.binary(),
        },
      },
    },
  };

  const repo = new ProtocolRepository();

  repo.loadProtocolMethod(protocols.shortUrl.protocol);
  repo.loadProtocolMethod(protocols.returnUndefined.protocol);
  repo.loadProtocolMethod(protocols.add.protocol);
  repo.loadProtocolMethod(protocols.getContent.protocol);
  pair.connection1.setProtocolRepository(repo);
  pair.connection2.setProtocolRepository(repo);

  const registry = new ServiceRegistry();
  registry.registerService({
    shortUrl: (url: string) => url.slice(0, 10),
    returnUndefined: () => undefined,
  });

  const client1 = new ProxySumi(registry);

  client1.listen(pair.connection1);
  const invoker1 = client1.getInvokeProxy();

  const registry2 = new ServiceRegistry();
  registry2.registerService({
    add: (a: number, b: number) => a + b,
    getContent: () => buffer,
  });

  const client2 = new ProxySumi(registry2);

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

export function createConnectionPair() {
  const channel = new MessageChannel();

  const { port1, port2 } = channel;

  const connection1 = new SumiConnection(new MessagePortConnection(port1));
  const connection2 = new SumiConnection(new MessagePortConnection(port2));

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

const messagePortPair = createConnectionPair();
const sumi = createSumiRPCClientPair(messagePortPair as any);

bench
  .add('simple: sumi rpc', async () => {
    await sumi.invoker1.add(1, 2);
    // log(result);
  })
  .add('buffer: sumi rpc', async () => {
    await sumi.invoker1.getContent();
  });

async function main() {
  await bench.warmup();
  await bench.run();

  console.table(bench.table());

  messagePortPair.close();
}

main();

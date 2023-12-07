import { Type } from '@furyjs/fury';

import { RPCProxyFury } from '../../../src/common';
import { RPCServiceProtocolRepository } from '../../../src/common/rpc-service-protocol-repository';

import { createFuryConnectionPair } from './utils';

describe('fury rpc', () => {
  let pair: ReturnType<typeof createFuryConnectionPair>;
  jest.setTimeout(1000 * 1000);
  beforeEach(() => {
    pair = createFuryConnectionPair();
  });

  afterEach(() => {
    pair && pair.close();
  });

  it('base', async () => {
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

    const repo = new RPCServiceProtocolRepository();

    repo.loadProtocolMethod('shortUrl', protocols.shortUrl.protocol);
    repo.loadProtocolMethod('add', protocols.add.protocol);

    const furyRPC1 = new RPCProxyFury({
      shortUrl: (url: string) => url.slice(0, 10),
    });

    furyRPC1.setProtocolRepository(repo);

    furyRPC1.listen(pair.connection1);
    const fury1InvokeProxy = furyRPC1.getRPCInvokeProxy();

    const furyRPC2 = new RPCProxyFury({
      add: (a: number, b: number) => a + b,
    });
    furyRPC2.setProtocolRepository(repo);
    furyRPC2.listen(pair.connection2);

    const fury2InvokeProxy = furyRPC2.getRPCInvokeProxy();

    const result = await fury1InvokeProxy.add(1, 2);
    expect(result).toBe(3);

    const result2 = await fury2InvokeProxy.shortUrl('1234567890abcdefg');
    expect(result2).toBe('1234567890');
  });
});

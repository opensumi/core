import { Type } from '@furyjs/fury';

import { IRPCWithProtocolServiceMap, RPCProxyFury } from '../../../src/common';

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
    const rpc1Map = {
      shortUrl: {
        method: (url: string) => url.slice(0, 10),
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
    } as IRPCWithProtocolServiceMap;

    const furyRPC1 = new RPCProxyFury(rpc1Map);

    furyRPC1.listen(pair.connection1);
    const fury1InvokeProxy = furyRPC1.getRPCInvokeProxy();

    const rpc2Map = {
      add: {
        method: (a: number, b: number) => a + b,
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
    } as IRPCWithProtocolServiceMap;

    const furyRPC2 = new RPCProxyFury(rpc2Map);
    furyRPC2.listen(pair.connection2);

    furyRPC1.loadProtocol(rpc2Map);
    furyRPC2.loadProtocol(rpc1Map);

    const fury2InvokeProxy = furyRPC2.getRPCInvokeProxy();

    const result = await fury1InvokeProxy.add(1, 2);
    expect(result).toBe(3);

    const result2 = await fury2InvokeProxy.shortUrl('1234567890abcdefg');
    expect(result2).toBe('1234567890');
  });
});

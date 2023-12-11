import { Type } from '@furyjs/fury';

import { MethodProtocolNotFoundError, ProxySumi } from '../../../src/common';
import { ProtocolRepository } from '../../../src/common/protocol-repository';

import { createConnectionPair } from './utils';

describe('sumi rpc', () => {
  let pair: ReturnType<typeof createConnectionPair>;
  jest.setTimeout(1000 * 1000);
  beforeEach(() => {
    pair = createConnectionPair();
  });

  afterEach(() => {
    pair && pair.close();
  });

  function createRPCClientPair() {
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

    repo.loadProtocolMethod('shortUrl', protocols.shortUrl.protocol);
    repo.loadProtocolMethod('returnUndefined', protocols.returnUndefined.protocol);
    repo.loadProtocolMethod('add', protocols.add.protocol);

    const client1 = new ProxySumi({
      shortUrl: (url: string) => url.slice(0, 10),
      returnUndefined: () => undefined,
    });

    client1.setProtocolRepository(repo);

    client1.listen(pair.connection1);
    const fury1InvokeProxy = client1.getInvokeProxy();

    const client2 = new ProxySumi({
      add: (a: number, b: number) => a + b,
    });
    client2.setProtocolRepository(repo);
    client2.listen(pair.connection2);

    const fury2InvokeProxy = client2.getInvokeProxy();

    return {
      repo,
      client1,
      client2,
      fury1InvokeProxy,
      fury2InvokeProxy,
    };
  }

  it('base', async () => {
    const { fury1InvokeProxy, fury2InvokeProxy } = createRPCClientPair();

    const result = await fury1InvokeProxy.add(1, 2);
    expect(result).toBe(3);

    const result2 = await fury2InvokeProxy.shortUrl('1234567890abcdefg');
    expect(result2).toBe('1234567890');

    const result3 = await fury2InvokeProxy.returnUndefined();
    expect(result3).toBeUndefined();
  });

  it('can throw error', async () => {
    const { fury1InvokeProxy, fury2InvokeProxy, client1, client2, repo } = createRPCClientPair();

    client1.listenService({
      shortUrl: (url: string) => {
        if (!url) {
          throw new Error('url is empty');
        }
        return url.slice(0, 10);
      },
    });
    client2.listenService({
      add: (a: number, b: number) => {
        if (a === 0) {
          throw new Error('a is zero');
        }
        return a + b;
      },
      throwAString: () => {
        // eslint-disable-next-line no-throw-literal
        throw 'a string';
      },
    });

    await expect(fury1InvokeProxy.add(0, 2)).rejects.toThrow('a is zero');
    await expect(fury2InvokeProxy.shortUrl('')).rejects.toThrow('url is empty');

    await expect(fury1InvokeProxy.throwAString()).rejects.toThrow(MethodProtocolNotFoundError);
    await expect(fury2InvokeProxy.throwAString()).rejects.toThrow(MethodProtocolNotFoundError);

    repo.loadProtocolMethod('throwAString', {
      method: 'throwAString',
      request: [],
      response: {
        type: Type.any(),
      },
    });

    try {
      await fury1InvokeProxy.throwAString();
    } catch (error) {
      expect(typeof error).toBe('string');
      expect(error).toBe('a string');
    }
  });
});

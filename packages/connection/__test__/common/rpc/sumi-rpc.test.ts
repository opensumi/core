import { Type } from '@furyjs/fury';

import { METHOD_NOT_REGISTERED } from '@opensumi/ide-connection/lib/common/constants';
import { Deferred } from '@opensumi/ide-core-common';
import { IReadableStream, listenReadable } from '@opensumi/ide-utils/lib/stream';

import { test } from './common-tester';
import { createConnectionPair, createSumiRPCClientPair, message } from './utils';

test('sumi rpc', {
  factory: createSumiRPCClientPair,
  pairFactory: createConnectionPair,
});

describe('sumi rpc only', () => {
  let pair: ReturnType<typeof createConnectionPair>;
  beforeEach(() => {
    pair = createConnectionPair();
  });

  afterEach(() => {
    pair && pair.close();
  });

  it('can throw error', async () => {
    const { invoker1, invoker2, client1, client2 } = createSumiRPCClientPair(pair);

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
    });

    await expect(invoker1.add(0, 2)).rejects.toThrow('a is zero');
    await expect(invoker2.shortUrl('')).rejects.toThrow('url is empty');

    await expect(invoker1.throwAString()).resolves.toEqual(METHOD_NOT_REGISTERED);
    await expect(invoker2.throwAString()).resolves.toEqual(METHOD_NOT_REGISTERED);

    client2.listenService({
      throwAString: () => {
        // eslint-disable-next-line no-throw-literal
        throw 'a string';
      },
    });

    try {
      await invoker1.throwAString();
    } catch (error) {
      expect(typeof error).toBe('string');
      expect(error).toBe('a string');
    }
  });

  it('can throw error when method not found', async () => {
    const { invoker1, invoker2, repo } = createSumiRPCClientPair(pair);
    repo.loadProtocolMethod({
      method: 'notFound',
      request: [],
      response: {
        type: Type.any(),
      },
    });

    await expect(invoker1.notFound()).resolves.toEqual(METHOD_NOT_REGISTERED);
    await expect(invoker2.notFound()).resolves.toEqual(METHOD_NOT_REGISTERED);
  });

  it('support readable stream', async () => {
    const { invoker1 } = createSumiRPCClientPair(pair);
    const result = (await invoker1.readFileStream('test.txt')) as IReadableStream<Uint8Array>;

    const deferred = new Deferred<void>();
    let msg = '';

    listenReadable(result, {
      onData: (d) => {
        msg += d.toString();
      },
      onEnd() {
        deferred.resolve();
      },
    });

    await deferred.promise;
    expect(msg).toBe(message);
  });
});

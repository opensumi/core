/* eslint-disable no-console */

import { OpenMessage, PingMessage, PongMessage, ServerReadyMessage, furySerializer } from '@opensumi/ide-connection';

const parse = furySerializer.deserialize;
const stringify = furySerializer.serialize;

describe('oneOf', () => {
  function testIt(obj: any) {
    const bytes = stringify(obj);
    const obj2 = parse(bytes);
    expect(obj2).toEqual(obj);
    const str = JSON.stringify(obj);

    console.log('bytes.length', bytes.byteLength);
    console.log('json length', str.length);
  }

  it('should serialize and deserialize', () => {
    const obj = {
      kind: 'ping',
      id: '456',
    } as PingMessage;

    testIt(obj);

    const obj2 = {
      kind: 'pong',
      id: '456',
    } as PongMessage;

    testIt(obj2);

    const obj3: OpenMessage = {
      kind: 'open',
      clientId: '123',
      id: '456',
      path: '/test',
    };

    testIt(obj3);

    const obj4: ServerReadyMessage = {
      kind: 'server-ready',
      id: '456',
      traceId: '',
    };

    testIt(obj4);

    const obj5 = {
      kind: 'data',
      id: '456',
      content: 'hello',
    };

    testIt(obj5);

    const obj6 = {
      kind: 'binary',
      id: '456',
      binary: Buffer.from([1, 2, 3]),
    };
    testIt(obj6);
  });
});

import { OpenMessage, PingMessage, PongMessage, ServerReadyMessage } from '../../../src/common/channel/types';
import { furySerializer } from '../../../src/common/serializer';

const parse = furySerializer.deserialize;
const stringify = furySerializer.serialize;

describe('oneOf', () => {
  function testIt(obj: any) {
    const bytes = stringify(obj);
    const obj2 = parse(bytes);

    // 确保 obj 里的所有字段都在 obj2 里
    // eslint-disable-next-line guard-for-in
    for (const key in Object.keys(obj)) {
      expect(obj2[key]).toEqual(obj[key]);
    }
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
      traceId: '',
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

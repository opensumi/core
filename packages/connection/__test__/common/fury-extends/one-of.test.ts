/* eslint-disable no-console */
import { Type } from '@furyjs/fury';

import { oneOf } from '@opensumi/ide-connection/src/common/fury-extends/one-of';

import { PongMessage } from '../../../lib';
import { ChannelMessage, PingMessage } from '../../../src/common/ws-channel';

export const PingProtocol = Type.object('ping', {
  clientId: Type.string(),
  id: Type.string(),
});

export const PongProtocol = Type.object('pong', {
  clientId: Type.string(),
  id: Type.string(),
});

export const OpenProtocol = Type.object('open', {
  clientId: Type.string(),
  id: Type.string(),
  path: Type.string(),
});

export const ServerReadyProtocol = Type.object('server-ready', {
  id: Type.string(),
});

export const DataProtocol = Type.object('data', {
  id: Type.string(),
  content: Type.string(),
});

export const BinaryProtocol = Type.object('binary', {
  id: Type.string(),
  binary: Type.binary(),
});

export const CloseProtocol = Type.object('close', {
  id: Type.string(),
  code: Type.uint32(),
  reason: Type.string(),
});

const serializer = oneOf([
  PingProtocol,
  PongProtocol,
  OpenProtocol,
  ServerReadyProtocol,
  DataProtocol,
  BinaryProtocol,
  CloseProtocol,
]);

function stringify(obj: ChannelMessage): Uint8Array {
  return serializer.serialize(obj);
}

function parse(input: Uint8Array): ChannelMessage {
  return serializer.deserialize(input) as any;
}

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
      clientId: '123',
      id: '456',
    } as PingMessage;

    testIt(obj);

    const obj2 = {
      kind: 'pong',
      clientId: '123',
      id: '456',
    } as PongMessage;

    testIt(obj2);

    const obj3 = {
      kind: 'open',
      clientId: '123',
      id: '456',
      path: '/test',
    };

    testIt(obj3);

    const obj4 = {
      kind: 'server-ready',
      id: '456',
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

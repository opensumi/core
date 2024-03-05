/* eslint-disable no-console */
// @ts-ignore
import { Bench } from 'tinybench';

import { oneOf7 } from '../src/common/fury-extends/one-of';
import {
  BinaryProtocol,
  ChannelMessage,
  CloseProtocol,
  DataProtocol,
  OpenProtocol,
  PingMessage,
  PingProtocol,
  PongMessage,
  PongProtocol,
  ServerReadyProtocol,
} from '../src/common/ws-channel';

const bench = new Bench({
  time: 2000,
});

const serializer = oneOf7([
  PingProtocol,
  PongProtocol,
  OpenProtocol,
  ServerReadyProtocol,
  DataProtocol,
  BinaryProtocol,
  CloseProtocol,
]);

export function parse(input: Uint8Array): ChannelMessage {
  return serializer.deserialize(input) as any;
}

function testIt(obj: any) {
  const bytes = serializer.serialize(obj);
  const obj2 = serializer.deserialize(bytes);
}

function testItJson(obj: any) {
  const json = JSON.stringify(obj);
  const obj2 = JSON.parse(json);
}

const obj = {
  kind: 'ping',
  clientId: '123',
  id: '456',
} as PingMessage;

const obj2 = {
  kind: 'pong',
  clientId: '123',
  id: '456',
} as PongMessage;
const obj3 = {
  kind: 'open',
  clientId: '123',
  id: '456',
  path: '/test',
};
const obj4 = {
  kind: 'server-ready',
  id: '456',
};
const obj5 = {
  kind: 'data',
  id: '456',
  content: 'hello',
};
const obj6 = {
  kind: 'binary',
  id: '456',
  binary: Buffer.from([1, 2, 3]),
};
bench
  .add('one of', () => {
    testIt(obj);
    testIt(obj2);
    testIt(obj3);
    testIt(obj4);
    testIt(obj5);
    testIt(obj6);
  })
  .add('one of json', () => {
    testItJson(obj);
    testItJson(obj2);
    testItJson(obj3);
    testItJson(obj4);
    testItJson(obj5);
    testItJson(obj6);
  })
  .add('one of serialize', () => {
    serializer.serialize(obj);
    serializer.serialize(obj2);
    serializer.serialize(obj3);
    serializer.serialize(obj4);
    serializer.serialize(obj5);
    serializer.serialize(obj6);
  })
  .add('one of json stringify', () => {
    JSON.stringify(obj);
    JSON.stringify(obj2);
    JSON.stringify(obj3);
    JSON.stringify(obj4);
    JSON.stringify(obj5);
    JSON.stringify(obj6);
  })
  .add('one of serialize without buffer', () => {
    serializer.serialize(obj);
    serializer.serialize(obj2);
    serializer.serialize(obj3);
    serializer.serialize(obj4);
    serializer.serialize(obj5);
  })
  .add('one of json stringify without buffer', () => {
    JSON.stringify(obj);
    JSON.stringify(obj2);
    JSON.stringify(obj3);
    JSON.stringify(obj4);
    JSON.stringify(obj5);
  });

async function main() {
  await bench.warmup();
  await bench.run();

  console.table(bench.table());
}

main();

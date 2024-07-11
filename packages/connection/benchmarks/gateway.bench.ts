/* eslint-disable no-console */
import crypto from 'crypto';

// @ts-ignore
import { Bench } from 'tinybench';

import { ChannelMessage, ErrorMessage, ErrorMessageCode, PingMessage, PongMessage } from '../src/common/channel';
import { oneOf } from '../src/common/fury-extends/one-of';
import {
  BinaryProtocol,
  CloseProtocol,
  DataProtocol,
  ErrorProtocol,
  OpenProtocol,
  PingProtocol,
  PongProtocol,
  ServerReadyProtocol,
} from '../src/common/serializer/fury';

const bench = new Bench({
  time: 2000,
});

const serializer = oneOf([
  PingProtocol,
  PongProtocol,
  OpenProtocol,
  ServerReadyProtocol,
  DataProtocol,
  BinaryProtocol,
  CloseProtocol,
  ErrorProtocol,
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
  id: '456',
} as PingMessage;

const obj2 = {
  kind: 'pong',
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
  content: 'a'.repeat(10 * 1024),
};

const obj6 = {
  kind: 'binary',
  id: '456',
  binary: crypto.randomBytes(10 * 1024),
};

const obj7 = {
  kind: 'error',
  code: ErrorMessageCode.ChannelNotFound,
  id: '456',
  message: 'not found',
} as ErrorMessage;

const serialized1 = serializer.serialize(obj);
const serialized2 = serializer.serialize(obj2);
const serialized3 = serializer.serialize(obj3);
const serialized4 = serializer.serialize(obj4);
const serialized5 = serializer.serialize(obj5);
const serialized6 = serializer.serialize(obj6);
const serialized7 = serializer.serialize(obj7);

const stringified1 = JSON.stringify(obj);
const stringified2 = JSON.stringify(obj2);
const stringified3 = JSON.stringify(obj3);
const stringified4 = JSON.stringify(obj4);
const stringified5 = JSON.stringify(obj5);
const stringified6 = JSON.stringify(obj6);
const stringified7 = JSON.stringify(obj7);

bench
  .add('[gateway] fury', () => {
    testIt(obj);
    testIt(obj2);
    testIt(obj3);
    testIt(obj4);
    testIt(obj5);
    testIt(obj6);
    testIt(obj7);
  })
  .add('[gateway] json', () => {
    testItJson(obj);
    testItJson(obj2);
    testItJson(obj3);
    testItJson(obj4);
    testItJson(obj5);
    testItJson(obj6);
    testItJson(obj7);
  })
  .add('[gateway] fury serialize', () => {
    serializer.serialize(obj);
    serializer.serialize(obj2);
    serializer.serialize(obj3);
    serializer.serialize(obj4);
    serializer.serialize(obj5);
    serializer.serialize(obj6);
    serializer.serialize(obj7);
  })
  .add('[gateway] json stringify', () => {
    JSON.stringify(obj);
    JSON.stringify(obj2);
    JSON.stringify(obj3);
    JSON.stringify(obj4);
    JSON.stringify(obj5);
    JSON.stringify(obj6);
    JSON.stringify(obj7);
  })
  .add('[gateway] fury serialize without buffer', () => {
    serializer.serialize(obj);
    serializer.serialize(obj2);
    serializer.serialize(obj3);
    serializer.serialize(obj4);
    serializer.serialize(obj5);
  })
  .add('[gateway] json stringify without buffer', () => {
    JSON.stringify(obj);
    JSON.stringify(obj2);
    JSON.stringify(obj3);
    JSON.stringify(obj4);
    JSON.stringify(obj5);
  })
  .add('[gateway] fury deserialize', () => {
    parse(serialized1);
    parse(serialized2);
    parse(serialized3);
    parse(serialized4);
    parse(serialized5);
    parse(serialized6);
    parse(serialized7);
  })
  .add('[gateway] json parse', () => {
    JSON.parse(stringified1);
    JSON.parse(stringified2);
    JSON.parse(stringified3);
    JSON.parse(stringified4);
    JSON.parse(stringified5);
    JSON.parse(stringified6);
    JSON.parse(stringified7);
  });

async function main() {
  await bench.warmup();
  await bench.run();

  console.table(bench.table());
}

main();

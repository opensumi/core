import { test } from './common-tester';
import { createLegacyRPCClientPair, createMessagePortLegacyConnectionPair } from './utils';

const factory = (pair: any) => createLegacyRPCClientPair(pair);

test('legacy json rpc', {
  factory,
  pairFactory: createMessagePortLegacyConnectionPair,
});

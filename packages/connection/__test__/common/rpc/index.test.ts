import { test } from './common-tester';
import { createLegacyRPCClientPair, createMessageConnectionPair } from './utils';

const factory = (pair: any) => createLegacyRPCClientPair(pair);

test('legacy json rpc', {
  factory,
  pairFactory: createMessageConnectionPair,
});

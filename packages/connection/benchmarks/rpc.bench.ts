/* eslint-disable no-console */
// @ts-ignore
import { Bench } from 'tinybench';

import {
  createConnectionPair,
  createLegacyRPCClientPair,
  createMessageConnectionPair,
  createSumiRPCClientPair,
} from '../__test__/common/rpc/utils';

const bench = new Bench({
  time: 20000,
});

const messagePair = createMessageConnectionPair();
const messagePortPair = createConnectionPair();
console.log(process.pid);

const legacy = createLegacyRPCClientPair(messagePair);

const sumi = createSumiRPCClientPair(messagePortPair);

bench
  .add('simple: legacy rpc', async () => {
    const result = await legacy.invoker1.add(1, 2);
    // log(result);
  })
  .add('simple: sumi rpc', async () => {
    const result = await sumi.invoker1.add(1, 2);
    // log(result);
  })
  .add('buffer: legacy rpc', async () => {
    await legacy.invoker1.getContent();
  })
  .add('buffer: sumi rpc', async () => {
    await sumi.invoker1.getContent();
  });

async function main() {
  await bench.warmup();
  await bench.run();

  console.table(bench.table());

  messagePair.close();
  messagePortPair.close();
}

main();

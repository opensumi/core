import { equal } from 'assert';

/* eslint-disable no-console */
// @ts-ignore
import { Bench } from 'tinybench';

import {
  createConnectionPair,
  createIPCConnectionPair,
  createLegacyRPCClientPair,
  createMessagePortLegacyConnectionPair,
  createMessagePortWSChannel,
  createSumiRPCClientPair,
} from '../__test__/common/rpc/utils';

const bench = new Bench({
  time: 2000,
});

const messagePair = createMessagePortLegacyConnectionPair();
const messagePortPair = createConnectionPair();
console.error('pid', process.pid);

const legacy = createLegacyRPCClientPair(messagePair);
const sumi = createSumiRPCClientPair(messagePortPair);

const wsChannelPair = createMessagePortWSChannel();

const legacyOverChannel = createLegacyRPCClientPair({
  connection1: wsChannelPair.channel1.createMessageConnection(),
  connection2: wsChannelPair.channel2.createMessageConnection(),
});

const sumiOverChannel = createSumiRPCClientPair({
  connection1: wsChannelPair.channel1.createSumiConnection(),
  connection2: wsChannelPair.channel2.createSumiConnection(),
});

async function main() {
  const ipcPair = await createIPCConnectionPair();
  const ipcSumi = createSumiRPCClientPair(ipcPair);

  const resultForLegacy = await legacy.invoker1.add(1, 2);
  equal(resultForLegacy, 3, 'legacy rpc result is not correct');

  const resultForSumi = await sumi.invoker1.add(1, 2);
  equal(resultForSumi, 3, 'sumi rpc result is not correct');

  const resultForIpc = await ipcSumi.invoker1.add(1, 2);
  equal(resultForIpc, 3, 'sumi rpc use socket result is not correct');

  const resultForLegacyOverChannel = await legacyOverChannel.invoker1.add(1, 2);
  equal(resultForLegacyOverChannel, 3, 'legacy rpc over channel result is not correct');

  const resultForSumiOverChannel = await sumiOverChannel.invoker1.add(1, 2);
  equal(resultForSumiOverChannel, 3, 'sumi rpc over channel result is not correct');

  bench
    .add('1+2: legacy rpc over message port', async () => {
      await legacy.invoker1.add(1, 2);
    })
    .add('1+2: sumi rpc over message port', async () => {
      await sumi.invoker1.add(1, 2);
    })
    .add('1+2: sumi rpc over socket', async () => {
      await ipcSumi.invoker1.add(1, 2);
    })
    .add('1+2: legacy rpc over ws channel', async () => {
      await legacyOverChannel.invoker1.add(1, 2);
    })
    .add('1+2: sumi rpc over ws channel', async () => {
      await sumiOverChannel.invoker1.add(1, 2);
    })
    .add('string(584b): legacy rpc over message port', async () => {
      await legacy.invoker1.getMessage();
    })
    .add('string(584b): sumi rpc over message port', async () => {
      await sumi.invoker1.getMessage();
    })
    .add('string(584b): sumi rpc over socket', async () => {
      await ipcSumi.invoker1.getMessage();
    })
    .add('string(1m): legacy rpc over message port', async () => {
      await legacy.invoker1.getLongMessage();
    })
    .add('string(1m): sumi rpc over message port', async () => {
      await sumi.invoker1.getLongMessage();
    })
    .add('string(1m): sumi rpc over socket', async () => {
      await ipcSumi.invoker1.getLongMessage();
    })
    .add('buffer(1m): legacy rpc over message port', async () => {
      await legacy.invoker1.getContent();
    })
    .add('buffer(1m): sumi rpc over message port', async () => {
      await sumi.invoker1.getContent();
    })
    .add('buffer(1m): sumi rpc over socket', async () => {
      await ipcSumi.invoker1.getContent();
    });

  await bench.warmup();
  await bench.run();

  console.table(bench.table());

  messagePair.close();
  messagePortPair.close();
  ipcPair.close();
  wsChannelPair.close();
}

main();

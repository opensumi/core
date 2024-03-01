/* eslint-disable no-console */
// @ts-ignore
import { Bench } from 'tinybench';

const bench = new Bench({
  time: 2000,
});

bench.add('', () => {});

async function main() {
  await bench.warmup();
  await bench.run();
}

main();

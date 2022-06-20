// 用来 debug 某个 packages 的测试有问题
// 该模块会一个个的跑每个 package 下的测试

import { command } from 'execa';

import { argv } from '../packages/core-common/src/node/cli';

import { getShardPackages } from './jest/shard';

let pkgs = getShardPackages();

const packagesDirNames = pkgs.map((pkg) => pkg.dirname);

const main = async () => {
  console.log(`current jest modules:`, packagesDirNames);
  const target = packagesDirNames.join(',');
  const env = {};
  if ((argv as any).strictPromise) {
    env['EXIT_ON_UNHANDLED_REJECTION'] = 'true';
  }
  let cmd = `yarn test:module --module=${target}`;

  if ((argv as any).runInBand === false) {
    cmd += ' --no-runInBand';
  }

  if ((argv as any).coverage) {
    cmd += ' --coverage';
  }

  console.log('cmd:', cmd, 'env:', env);
  await command(cmd, {
    reject: false,
    stdio: 'inherit',
    shell: true,
    env,
  });

  console.log(`end module:`, target);
};

main();

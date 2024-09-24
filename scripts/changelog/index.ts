#!/usr/bin/env node
import chalk from 'chalk';

import { argv } from '../../packages/core-common/src/node/cli';

import { run } from './run';

if (!process.env.GITHUB_TOKEN) {
  console.log(chalk.red('Please export your github personal access token as env `GITHUB_TOKEN`'));
  console.log(chalk.green('You can access your own access token by https://github.com/settings/tokens'));
  console.log(chalk.yellow('Please keep your github access token carefully'));
  process.exit();
}

// yarn run changelog --from=v1.34.0 --to=1.35.0
// yarn run changelog --from=v1.34.0
const from = argv.from as string;
const to = argv.to as string;
const isRemote = argv.remote as boolean;
const isRelease = argv.release as boolean;
run(from, to, {
  isRemote,
  isRelease,
});

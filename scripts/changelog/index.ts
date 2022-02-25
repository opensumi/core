#!/usr/bin/env node
import { argv } from 'yargs';
import { run } from './run';
import chalk from 'chalk';

if (!process.env.GITHUB_TOKEN) {
  console.log(chalk.red('Please export your github persional access token as env `GITHUB_TOKEN`'));
  console.log(chalk.green('You can access your own access token by https://github.com/settings/tokens'));
  console.log(chalk.yellow('Please keep your github access token carefully'));
  process.exit();
}

// npm run changelog -- --from=v1.34.0 --to=1.35.0
// npm run changelog -- --from=v1.34.0
const from = argv.from as string;
const to = argv.to as string;
const isRemote = argv.remote as boolean;
const isRelease = argv.release as boolean;
run(from, to, {
  isRemote,
  isRelease,
});

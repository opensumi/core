#!/usr/bin/env node
import { argv } from 'yargs';
import chalk from 'chalk';
import { run } from './run';

if (!process.env.ANTCODE_PRIVATE_TOKEN) {
  console.log(chalk.red('Please export your AntCode private token as env `ANTCODE_PRIVATE_TOKEN`'));
  console.log(chalk.green('You can access your own private secret by https://code.alipay.com/profile/private_tokens'));
  console.log(chalk.yellow('Please keep your antcode private secret carefully'));
  process.exit();
}

// npm run changelog -- --from=v1.34.0 --to=1.35.0
// npm run changelog -- --from=v1.34.0
const from = argv.from as string;
const to = argv.to as string;
run(from, to);

import { join } from 'path';
import { readdirSync, existsSync } from 'fs-extra';
import { createInterface } from 'readline';
import * as semver from 'semver';
import { argv } from '../packages/core-common/src/node/cli';

import Package from './pkg';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

const packagesDir = join(__dirname, '../packages');

/**
 * todos
 * 统一修改 npm dist-tags
 */

interface IDisposable {
  dispose: () => void;
}

const packages = new Map<string, Package>();

// 当publish结束或者process
const subscriptions: Array<IDisposable> = [];

function cleanSideEffect() {
  if (argv.rollback && subscriptions.length > 0) {
    console.log('回滚package.json..');
    while (subscriptions.length > 0) {
      const sub = subscriptions.pop()!;
      sub.dispose();
    }
  }
}

function runTaskWithPackages(version, tag) {
  const packagesDirNames = readdirSync(packagesDir);

  packagesDirNames.forEach((name) => {
    if (name.startsWith('.') || !existsSync(join(packagesDir, name, 'package.json'))) {
      return;
    }
    const p = new Package(join(packagesDir, name));
    packages.set(p.name, p);
  });

  let i = 1;

  packages.forEach((p) => {
    process.stdout.write(`[进度: ${i}/${packages.size}]`);
    p.distTag(version, tag);
    i++;
  });
}

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function main() {
  const distTagStr = await ask('需要更新的 dist tag 是?');
  if (!distTagStr) {
    console.error(`${distTagStr} 不是一个正确的dist tag`);
    return;
  }

  const version = await ask('对应的版本号是?');
  const semverVersion = semver.valid(version);
  if (!semverVersion) {
    console.error(`${version} 不是一个正确的版本号`);
    return;
  } else {
    try {
      const desc = `你确定要更新的 dist-tag: [${distTagStr}] 版本是: ${semverVersion}`;
      rl.question(desc, () => {
        runTaskWithPackages(semverVersion, distTagStr);
        console.log('[SUCCESS]成功');
        process.exit();
      });
    } finally {
      cleanSideEffect();
    }
  }
}

process.on('exit', () => {
  cleanSideEffect();
});

process.on('SIGINT', () => {
  cleanSideEffect();
});

process.on('SIGTERM', () => {
  cleanSideEffect();
});

main();

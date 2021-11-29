// tslint:disable:no-console
import { join } from 'path';
import { readFileSync, writeFileSync, ensureFileSync } from 'fs-extra';
import { execSync } from 'child_process';
import { createInterface } from 'readline';
import * as semver from 'semver';
import { argv } from 'yargs';
import * as git from 'git-rev-sync';
import * as chalk from 'chalk';

import * as pkg from '../package.json';
import Package, { readAllMainPackages } from './pkg';
import { generateManifest } from './manifest';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

interface IDisposable {
  dispose: () => void;
}

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

function updateFileWithDispose(filePath: string, content: any | ((original: string) => any)) {
  ensureFileSync(filePath);
  const original = readFileSync(filePath, { encoding: 'utf8' });
  let newContent = content;
  if (typeof content === 'function') {
    newContent = content(original);
  }
  writeFileSync(filePath, `${JSON.stringify(newContent, null, 2)}\n`);

  subscriptions.push({
    dispose: () => {
      writeFileSync(filePath, original);
    },
  });
}

const mainPkgPath = join(__dirname, '../package.json');
// 更新根目录 package.json 的版本号
function updatePackVersion(version: string) {
  updateFileWithDispose(mainPkgPath, (original: string) => {
    const json = JSON.parse(original);
    json.version = version;
    return json;
  });
}

/**
 * 生成对应版本号的 manifest.json，包括:
 * * packages 字段，包含所有包名和对应的版本号
*/
const localManifest = join(__dirname, '../packages/types/manifest.json');

async function generateManifestFile(pkgList: Package[], version: string) {
  const manifest = await generateManifest(pkgList, version);

  updateFileWithDispose(localManifest, manifest);
}

function doPublishPackages(packages, version, distTag) {
  let i = 1;

  packages.forEach((p) => {
    process.stdout.write(`[进度: ${i}/${packages.length}]`);
    p.publish(version, packages, distTag, subscriptions);
    i++;
  });

  process.stdout.write('[进度: 更新根目录版本号]');
  updatePackVersion(version);

  // 在非回滚模式下，提交一个 release 的 commit，并且打一个 tag
  if (!argv.rollback && !argv.versionOnly) {
    execSync(`git commit -a -m 'chore: ${version}' && git tag v${version}`, {
      env: process.env,
      stdio: ['pipe', 'ignore', 'pipe'],
    });
  }
}

async function publishMainPacks(version, distTag) {
  const packages: Package[] = readAllMainPackages();

  process.stdout.write('[进度: 生成 manifest.json]');
  await generateManifestFile(packages, version);

  doPublishPackages(packages, version, distTag);
}

function askVersion() {
  const distTag = argv.type || argv.tag;

  if (distTag && ['snapshot', 'next'].includes(distTag as string)) {
    const version = `${semver.inc(pkg.version, 'patch')}-${distTag}-${git.long().slice(0, 8)}`;
    console.log(`即将发布的 ${distTag }版本为: ${version}`);
    publish(version, distTag as string);
    return;
  }

  const desc = `当前版本为 ${chalk.greenBright(pkg.version)}\n输入要${argv.versionOnly ? '更新' : '发布'}的版本号:`;
  rl.question(desc, (version) => {
    publish(version);
  });
}

function publish(version, distTag = 'latest') {
  const semverVersion = semver.valid(version);
  if (!semverVersion) {
    console.error(`${version} 不是一个正确的版本号`);
    askVersion();
    return;
  } else {
    try {
      const desc = `确认要${argv.versionOnly ? '更新' : '发布'}版本: ${chalk.green(semverVersion)}\ndistTag: ${chalk.green(distTag)} \nplease press any key to continue`;
      rl.question(desc, async () => {
        await publishMainPacks(semverVersion, distTag);
        console.log('[SUCCESS]全部发布成功');
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

if (argv.targetVersion) {
  publish(argv.targetVersion);
} else {
  askVersion();
}

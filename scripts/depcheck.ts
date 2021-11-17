
import { join, resolve, relative } from 'path';
import * as depcheck from 'depcheck';
import * as chalk from 'chalk';
import { readdirSync, existsSync } from 'fs-extra';
import { argv } from 'yargs';

const packagesDir = join(__dirname, '../packages');

const options = {
  ignoreBinPackage: false, // ignore the packages with bin entry
  skipMissing: false, // skip calculation of missing dependencies
  ignoreDirs: [
    'bower_components',
    'node_modules',
    'lib',
  ],
  ignoreMatches: [
    '@ide-framework/ide-core-browser',
    '@ide-framework/ide-core-common',
    '@ide-framework/ide-core-node',
    '@ide-framework/ide-components',
    // devtool related
    '@ide-framework/ide-dev-tool',
    'npm-run-all',
    'ts-node',
    'webpack-dev-server',
    '@types/*',
  ],
  parsers: {
    // the target parsers
    '*.ts': depcheck.parser.typescript,
    '*.tsx': depcheck.parser.typescript,
  },
  detectors: [
    // the target detectors
    depcheck.detector.requireCallExpression,
    depcheck.detector.importDeclaration,
  ],
  specials: [
    // the target special parsers
    depcheck.special.eslint,
    depcheck.special.webpack,
  ],
};

function check(rootDir: string, config = {
  unusedDependency: true,
  unusedDevDependency: true,
  missing: true,
}) {
  return new Promise<void>((resolve) => {
    const cwd = process.cwd();
    depcheck(rootDir, options, (unused) => {
      if (config.unusedDependency) {
        if (unused.dependencies.length > 0) {
          console.log(chalk.yellow('Unused dependencies:'));
          unused.dependencies.forEach((dependency) => {
            console.log('* ' + dependency);
          });
        } else {
          console.log(chalk.greenBright('No unused dependency'));
        }
      }

      if (config.unusedDevDependency) {
        if (unused.devDependencies.length > 0) {
          console.log(chalk.yellow('Unused devDependencies:'));
          unused.devDependencies.forEach((dependency) => {
            console.log('* ' + dependency);
          });
        } else {
          console.log(chalk.greenBright('No unused devDependency'));
        }
      }

      if (config.missing) {
        const missingDeps = Object.keys(unused.missing);
        if (missingDeps.length > 0) {
          console.log(chalk.red('Missing dependencies:'));
          missingDeps.forEach((dependency) => {
            console.log(chalk.red(`* ${dependency} used in:`));
            unused.missing[dependency].forEach((referencePath, index) => {
              console.log(`  ${index + 1}. ${relative(cwd, referencePath)}`);
            });
          });
        } else {
          console.log(chalk.greenBright('No missing dependency'));
        }
      }

      resolve();
    });
  });
}

async function runTaskWithPackages(targetPacks: string[]) {
  for (const targetModuleName of targetPacks) {
    const packageDir = join(packagesDir, targetModuleName);

    if (packageDir.startsWith('.') || !existsSync(join(packageDir, 'package.json'))) {
      console.log(chalk.bgYellow(`${targetModuleName} is invalid module`));
      continue;
    }

    console.log(chalk.greenBright(`--- [检查依赖: ${targetModuleName}] ---`));
    await check(packageDir);
    console.log('\n');
  }

  process.exit();
}

async function bootAll() {
  const packagesDirNames = readdirSync(packagesDir);

  const targetPacks = packagesDirNames.reduce((prev, modulePath) => {
    // 前端依赖都安装到了 core-browser 里面，跳过检查
    if (['core-browser'].includes(modulePath)) {
      return prev;
    }

    prev.push(modulePath);
    return prev;
  }, [] as string[]);

  runTaskWithPackages(targetPacks);
}

// 指定模块加载
if (argv.module) {
  console.log(`单模块模式依赖检查: ${argv.module}`);
  const moduleName = (argv.module as string).replace(/@ali\//, '');
  runTaskWithPackages([moduleName]);
} else {
  console.log('项目级别依赖检查');
  bootAll();
}

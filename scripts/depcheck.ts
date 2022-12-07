import { join, relative } from 'path';
import depcheck from 'depcheck';
import chalk from 'chalk';
import { readdirSync, existsSync } from 'fs-extra';
import { argv } from '../packages/core-common/src/node/cli';

const packagesDir = join(__dirname, '../packages');

const ghostDepsWhiteLists = [
  // common deps from `@opensumi/ide-core-browser` or `@opensumi/ide-core-node`.
  '@opensumi/di',
  'ajv',
  'fuzzy',
  'jsonc-parser',
  'classnames',
  'react',
  'react-dom',
  'fs-extra',
  'lodash',
  'mobx',
  'mobx-react-lite',
  '@opensumi/monaco-editor-core',
  '@opensumi/vscode-debugprotocol',
  'vscode',
  'vscode-textmate',
  'react-window',
  'react-ctxmenu-trigger',
  'vscode-languageserver-types',
  'react-is',
  'ws',
  'koa',
];

const options = {
  ignoreBinPackage: false, // ignore the packages with bin entry
  skipMissing: false, // skip calculation of missing dependencies
  ignoreDirs: ['bower_components', 'node_modules', 'lib', '__tests__'],
  ignoreMatches: [
    // devtool related
    '@opensumi/ide-dev-tool',
    'npm-run-all',
    'ts-node',
    'webpack-dev-server',
    '@types/*',
  ],
  ignorePatterns: ['__tests__', '__mocks__'],
  parsers: {
    // the target parsers
    '**/*.ts': depcheck.parser.typescript,
    '**/*.tsx': depcheck.parser.typescript,
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

function check(
  rootDir: string,
  config = {
    unusedDependency: true,
    unusedDevDependency: true,
    missing: true,
  },
) {
  return new Promise<void>((resolve) => {
    const cwd = process.cwd();
    depcheck(rootDir, options, (unused) => {
      if (config.unusedDependency) {
        if (unused.dependencies.length > 0) {
          console.log(chalk.yellow('Unused dependencies (or dynamic import):'));
          unused.dependencies.forEach((dependency) => {
            console.log('* ' + dependency);
          });
        } else {
          // console.log(chalk.greenBright('No unused dependency'));
        }
      }

      if (config.unusedDevDependency) {
        if (unused.devDependencies.length > 0) {
          console.log(chalk.yellow('Unused devDependencies:'));
          unused.devDependencies.forEach((dependency) => {
            console.log('* ' + dependency);
          });
        } else {
          // console.log(chalk.greenBright('No unused devDependency'));
        }
      }
      if (config.missing) {
        let missingDeps = Object.keys(unused.missing).filter(
          (dep) => !ghostDepsWhiteLists.includes(dep) && (!rootDir.endsWith('browser') || !rootDir.endsWith('node')),
        );
        // 排除自身对模块的引用影响
        missingDeps = missingDeps.filter((dep) => {
          return !rootDir.endsWith(dep.split('ide-')[1]);
        });
        if (missingDeps.length > 0) {
          console.log(chalk.red('Missing dependencies:'));
          missingDeps.forEach((dependency) => {
            console.log(chalk.red(`* ${dependency} used in:`));
            unused.missing[dependency].forEach((referencePath, index) => {
              console.log(`  ${index + 1}. ${relative(cwd, referencePath)}`);
            });
          });
        } else {
          // console.log(chalk.greenBright('No missing dependency'));
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

    console.log(chalk.greenBright(`--- [Deps check: ${targetModuleName}] ---`));
    await check(packageDir);
    console.log('');
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

const targetModule = (argv as any).module as string;

// 指定模块加载
if (targetModule) {
  console.log(`Single module mode dependency check: ${targetModule}`);
  const moduleName = targetModule.replace(/@ali\//, '');
  runTaskWithPackages([moduleName]);
} else {
  console.log('Project level dependency check');
  bootAll();
}

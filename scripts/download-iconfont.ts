// eslint-disable-next-line no-console

import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

import Hbs from 'handlebars';
import isGitClean from 'is-git-clean';
import download from 'offline-iconfont';
import chalk from 'chalk';

import { IDE_ICONFONT_CN_CSS } from '../packages/core-browser/src/style/icon/ide-iconfont';
import { defaultIconfont } from '../packages/components/src/icon/iconfont/iconMap';
import pkg from '../package.json';

const targetDir = path.resolve(__dirname, '../packages/components/src/icon/iconfont');

const filename = 'iconfont';

const classNameRegexp = /\.kticon\-(.+)::?before/gi;

const fsReadFile = promisify(fs.readFile);
const fsWriteFile = promisify(fs.writeFile);

async function ensureGitClean() {
  let clean = false;
  try {
    clean = await isGitClean();
  } catch (err) {
    if (err && err.stderr && err.stderr.includes('Not a git repository')) {
      clean = true;
    }
  }

  if (!clean) {
    console.log(chalk.yellow('Sorry that there are still some git changes'));
    console.log('\n you must commit or stash them firstly');
    process.exit(1);
  }
}

async function generateHtmlTemplate(iconList: string[], cssUrl: string, version: string) {
  const htmlTemplate = await fsReadFile(__dirname + '/iconfont-template.html', { encoding: 'utf8' });
  const templateFn = Hbs.compile(htmlTemplate);
  const content = templateFn({ iconList, cssUrl, version });
  await fsWriteFile(path.resolve(targetDir, './iconfont.html'), content, { encoding: 'utf8' });
}

async function diagnosis() {
  const cssFilePath = path.join(targetDir, filename + '.css');
  const cssContent = await fsReadFile(cssFilePath, { encoding: 'utf8' });

  const iconNameList: string[] = [];

  let matched;
  while ((matched = classNameRegexp.exec(cssContent))) {
    const [, iconName] = matched;
    iconNameList.push(iconName);
  }

  if (!iconNameList.length) {
    throw new Error('Cannot find any matched icon names');
  }

  const existedIconMap = Object.keys(defaultIconfont);
  const stripIcons = existedIconMap.filter((n) => !iconNameList.includes(n));
  if (stripIcons.length) {
    console.log(chalk.yellow(`WARNING: ${stripIcons.length} icons below was removed`));
    console.log(stripIcons.map((iconName) => `* ${iconName}`).join('\n'));
  }

  const newIcons = iconNameList.filter((n) => !existedIconMap.includes(n));
  if (newIcons.length) {
    console.log(chalk.green(`${newIcons.length} NEW ICONS:`));
    console.log(newIcons.map((iconName) => `* ${iconName}`).join('\n'));
  }

  await fsWriteFile(
    path.join(targetDir, 'iconMap.ts'),
    '// GENERATE BY ./scripts/download-iconfont.ts\n// DON NOT EDIT IT MANUALLY\n' +
      'export const defaultIconfont = {\n' +
      iconNameList
        .map((iconName) => `  '${iconName}': '${iconName}'`)
        .sort()
        .join(',\n') +
      ',\n};\n',
    { encoding: 'utf8' },
  );
  return iconNameList;
}

async function bootstrap() {
  await ensureGitClean();

  await download({
    cssUrl: IDE_ICONFONT_CN_CSS,
    dir: targetDir,
    filename,
  });
  const iconNameList = await diagnosis();
  await generateHtmlTemplate(iconNameList, IDE_ICONFONT_CN_CSS, pkg.version);
}

bootstrap();

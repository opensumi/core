import * as path from 'path';
import * as glob from 'glob';
import * as fs from 'fs-extra';
import { packagesDir, toolsDir } from './dir-constants';
import { run } from './shell';
import camelCase from 'lodash/camelCase';
import upperFirst from 'lodash/upperFirst';

const templateDir = path.join(toolsDir, '/template');
const templatePattern = path.join(templateDir, '/**');

function createModuleTsConfig(name: string) {
  return {
    extends: '../tsconfig.base.json',
    compilerOptions: {
      rootDir: `../../../packages/${name}/src`,
      outDir: `../../../packages/${name}/lib`,
    },
    include: [`../../../packages/${name}/src`],
  };
}

function createReplaceTuple(key: string, value: string): [RegExp, string] {
  return [new RegExp(key, 'g'), value];
}

export async function createPackage(name: string) {
  if (!name) {
    throw new Error(`Can't create package with name: "${name}"`);
  }

  const isExists = await fs.pathExists(path.join(packagesDir, `/${name}/package.json`));
  if (isExists) {
    throw new Error(`${name} is exists, can't create once more.`);
  }

  const filePaths = glob.sync(templatePattern);
  const replaceList = [
    createReplaceTuple('template-name', `@opensumi/ide-${name}`),
    createReplaceTuple('TemplateUpperName', upperFirst(camelCase(name))),
  ];

  // 从 template 复制文件
  for (const filePath of filePaths) {
    const stat = await fs.stat(filePath);
    if (stat.isFile()) {
      const buffer = await fs.readFile(filePath, 'utf-8');

      const content = replaceList.reduce((ret, [reg, value]) => {
        return ret.replace(reg, value);
      }, buffer.toString());

      const relativePath = path.relative(templateDir, filePath);
      const resultPath = path.join(packagesDir, name, relativePath);

      await fs.mkdirp(path.dirname(resultPath));
      await fs.writeFile(resultPath, content, 'utf-8');
    }
  }

  // 创建 tsconfig.json
  const buildJsonPath = path.join(__dirname, '../../configs/ts/tsconfig.build.json');
  const buildTsConfig = require(buildJsonPath);
  buildTsConfig.references.push({ path: `./references/tsconfig.${name}.json` });
  await fs.writeFile(buildJsonPath, JSON.stringify(buildTsConfig, null, 2) + '\n');

  const resolveJsonPath = path.join(__dirname, '../../configs/ts/tsconfig.resolve.json');
  const resolveTsConfig = require(resolveJsonPath);
  const extendPaths = {
    [`@opensumi/ide-${name}`]: [`../packages/${name}/src/index.ts`],
    [`@opensumi/ide-${name}/lib/*`]: [`../packages/${name}/src/*`],
  };
  Object.assign(resolveTsConfig.compilerOptions.paths, extendPaths);
  await fs.writeFile(resolveJsonPath, JSON.stringify(resolveTsConfig, null, 2) + '\n');

  const moduleTsJsonPath = path.join(__dirname, `../../configs/ts/references/tsconfig.${name}.json`);
  const moduleTsConfig = createModuleTsConfig(name);
  await fs.writeFile(moduleTsJsonPath, JSON.stringify(moduleTsConfig, null, 2) + '\n');

  // 创建完模块之后执行一次初始化
  run('npm run init');
}

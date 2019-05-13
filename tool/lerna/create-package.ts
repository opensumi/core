import * as path from 'path';
import * as glob from 'glob';
import * as pkg from '../../lerna.json';
import * as fs from 'fs-extra';

const templateDir = path.join(__dirname, './template');
const templatePattern = path.join(__dirname, './template/**');
const packagesDir = path.join(__dirname, '../../packages');

const specialKey = '00000';
function createReplaceTuple(key: string, value: string): [RegExp, string] {
  return [new RegExp(`${specialKey}${key}`, 'g'), value];
}

export async function createPackage(name: string) {
  if (!name) {
    throw new Error(`Can't create package with name: "${name}"`);
  }

  const version = pkg.version;
  const filePaths = glob.sync(templatePattern);
  const replaceList = [
    createReplaceTuple('name', name),
    createReplaceTuple('version', version),
  ];

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
}

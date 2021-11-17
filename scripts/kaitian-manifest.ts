// tslint:disable:no-console
import { join } from 'path';
import * as _ from 'lodash';
import * as fs from 'fs';
import Package from './pkg';

/**
 * 生成对应版本号的 manifest.json，包括:
*/
export async function generateManifest(pkgList: Package[], version: string) {
  const manifest = {
    meta: await collectPkgContains(pkgList, version),
    packages: collectPkgVersionList(pkgList, version),
  };

  return manifest;
}

/**
 * packages 字段，包含所有包名和对应的版本号
 */
export function collectPkgVersionList(pkgList: Package[], version: string) {
  return Array.from(pkgList.map(p => p.name)).reduce((prev, cur) => {
    prev[cur] = version;
    return prev;
  }, {} as { [key: string]: string });
}

/**
 * 收集每个包下的 browser/node/common 入口信息
 */
export async function collectPkgContains(pkgList: Package[], version: string) {
  const result = {};
  for (const pkg of pkgList) {
    const pkgName = pkg.name;
    const pkgPath = pkg.path;
    const pkgSrcPath = join(pkgPath, 'src');

    const desc = {
      node: await exists(join(pkgSrcPath, '/node/index.ts')),
      browser: await exists(join(pkgSrcPath, '/browser/index.ts')),
      common: await exists(join(pkgSrcPath, '/common/index.ts')),
    };

    const entries: string[] = [];
    for (const entryIdentifier of [
      'node',
      'browser',
      'common',
    ]) {
      const existed = await exists(join(pkgSrcPath, entryIdentifier, 'index.ts'));
      if (existed) {
        entries.push(entryIdentifier);
      }
    }

    result[pkgName] = {
      version,
      entry: entries,
    };
  }
  return result;
}

function exists(filePath: string) {
  return fs.promises.access(filePath)
    .then(() => true)
    .catch(() => false);
}

function trim4Obj(obj: object) {
  return _.pickBy(obj, _.identity);
}

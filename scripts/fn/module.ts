import * as path from 'path';

import { packageName, packagesDir } from './dir-constants';
import { run } from './shell';

export function getPkgFromFolder(folderName: string) {
  const packageJsonPath = path.join(packagesDir, `./${folderName}/${packageName}`);
  return require(packageJsonPath);
}

export async function startFromFolder(folderName: string, scriptName: string = 'start') {
  await run(`cd ${folderName} && yarn run ${scriptName}`);
}

export async function addNodeDep(folderName: string, depName: string) {
  const pkg = getPkgFromFolder(folderName);
  await addDep(depName, pkg.name);
}

export async function addBrowserDep(depName: string) {
  const pkg = getPkgFromFolder('core-browser');
  await addDep(depName, pkg.name);
}

export async function addDep(depName: string, pkgName: string) {
  await run(`npx lerna add ${depName} --scope ${pkgName}`);
  await run('yarn run init');
}

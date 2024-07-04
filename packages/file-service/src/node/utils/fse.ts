import * as fse from 'fs-extra';

export async function checkIsDirectory(path: string) {
  return (await fse.lstat(path)).isDirectory();
}

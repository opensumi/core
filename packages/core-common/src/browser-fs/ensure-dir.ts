import * as fs from 'fs';
import { promisify } from './util';

const PATH_SEPARATOR = '/';

function fsExistsAsync(path: string): Promise<boolean> {
  return new Promise((resolve) => {
    fs.exists(path, (exists: boolean) => {
      resolve(exists);
    });
  });
}

export async function ensureDir(path: string, mkdirImpl?: (path: string) => Promise<void>) {
  const pathList = (path.startsWith(PATH_SEPARATOR) ? path.slice(0) : path).split(PATH_SEPARATOR);
  let i = 0;
  while (i < pathList.length) {
    const targetPath = PATH_SEPARATOR + pathList.slice(0, i + 1).join(PATH_SEPARATOR);
    if (!await fsExistsAsync(targetPath)) {
      await (mkdirImpl ? mkdirImpl(PATH_SEPARATOR + targetPath) : promisify(fs.mkdir)(PATH_SEPARATOR + targetPath));
    }
    i = i + 1;
  }
}

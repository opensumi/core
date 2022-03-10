import fs from 'fs';

import { promisify } from './util';

const PATH_SEPARATOR = '/';

function fsExistsAsync(path: string): Promise<boolean> {
  return new Promise((resolve) => {
    fs.exists(path, (exists: boolean) => {
      resolve(exists);
    });
  });
}

interface FsLike {
  access: (path: string) => Promise<boolean>;
  mkdir: (path: string) => Promise<void>;
}

class DefaultFsImpl implements FsLike {
  access(path: string): Promise<boolean> {
    return new Promise((resolve) => {
      fs.exists(path, (exists: boolean) => {
        resolve(exists);
      });
    });
  }

  mkdir(path: string): Promise<void> {
    return promisify(fs.mkdir)(path);
  }
}

const defaultFsImpl = new DefaultFsImpl();

export async function ensureDir(path: string, fsLikeImpl: FsLike = defaultFsImpl) {
  const pathList = (path.startsWith(PATH_SEPARATOR) ? path.slice(0) : path).split(PATH_SEPARATOR);
  let i = 0;
  while (i < pathList.length) {
    const targetPath = PATH_SEPARATOR + pathList.slice(0, i + 1).join(PATH_SEPARATOR);
    if (!(await fsLikeImpl.access(targetPath))) {
      await fsLikeImpl.mkdir(PATH_SEPARATOR + targetPath);
    }
    i = i + 1;
  }
}

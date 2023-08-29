import * as fs from 'fs';
import { promisify } from 'util';

// export interface IDirent {
//   name: string;

//   isFile(): boolean;
//   isDirectory(): boolean;
//   isSymbolicLink(): boolean;
// }

// async function readdir(path: string): Promise<string[]>;
// async function readdir(path: string, options: { withFileTypes: true }): Promise<IDirent[]>;
// async function readdir(path: string, options?: { withFileTypes: true }): Promise<(string | IDirent)[]> {
//   return handleDirectoryChildren(await (options ? safeReaddirWithFileTypes(path) : promisify(fs.readdir)(path)));
// }

// async function safeReaddirWithFileTypes(path: string): Promise<IDirent[]> {
//   try {
//     return await promisify(fs.readdir)(path, { withFileTypes: true });
//   } catch (error) {
//     console.warn('[node.js fs] readdir with filetypes failed with error: ', error);
//   }

//   // Fallback to manually reading and resolving each
//   // children of the folder in case we hit an error
//   // previously.
//   // This can only really happen on exotic file systems
//   // such as explained in #115645 where we get entries
//   // from `readdir` that we can later not `lstat`.
//   const result: IDirent[] = [];
//   const children = await readdir(path);
//   for (const child of children) {
//     let isFile = false;
//     let isDirectory = false;
//     let isSymbolicLink = false;

//     try {
//       const lstat = await Promises.lstat(join(path, child));

//       isFile = lstat.isFile();
//       isDirectory = lstat.isDirectory();
//       isSymbolicLink = lstat.isSymbolicLink();
//     } catch (error) {
//       console.warn('[node.js fs] unexpected error from lstat after readdir: ', error);
//     }

//     result.push({
//       name: child,
//       isFile: () => isFile,
//       isDirectory: () => isDirectory,
//       isSymbolicLink: () => isSymbolicLink,
//     });
//   }

//   return result;
// }

// function handleDirectoryChildren(children: string[]): string[];
// function handleDirectoryChildren(children: IDirent[]): IDirent[];
// function handleDirectoryChildren(children: (string | IDirent)[]): (string | IDirent)[];
// function handleDirectoryChildren(children: (string | IDirent)[]): (string | IDirent)[] {
//   return children.map((child) => {
//     // Mac: uses NFD unicode form on disk, but we want NFC
//     // See also https://github.com/nodejs/node/issues/2165

//     if (typeof child === 'string') {
//       return isMacintosh ? normalizeNFC(child) : child;
//     }

//     child.name = isMacintosh ? normalizeNFC(child.name) : child.name;

//     return child;
//   });
// }
export const Promises = new (class {
  /** 风格转换：promisify将回调函数转换为promise的形式 */
  get access() {
    return promisify(fs.access); /** fs.access测试用户对指定的文件或目录的权限 */
  }

  //   fs.stat可以获取文件信息
  get stat() {
    return promisify(fs.stat);
  }
  get lstat() {
    return promisify(fs.lstat);
  }
  get utimes() {
    return promisify(fs.utimes);
  }

  get read() {
    return (fd: number, buffer: Uint8Array, offset: number, length: number, position: number | null) =>
      new Promise<{ bytesRead: number; buffer: Uint8Array }>((resolve, reject) => {
        /** 使用文件描述符读取文件 */
        fs.read(fd, buffer, offset, length, position, (err, bytesRead, buffer) => {
          if (err) {
            return reject(err);
          }

          /** 在读取操作后，byteRead被设置为缓冲区中实际放置的数据的字节数。如果读取失败并返回代码8或12，则将其设置为0*/
          return resolve({ bytesRead, buffer });
        });
      });
  }
  get readFile() {
    return promisify(fs.readFile);
  }

  get write() {
    return (
      fd: number,
      buffer: Uint8Array,
      offset: number | undefined | null,
      length: number | undefined | null,
      position: number | undefined | null,
    ) =>
      new Promise<{ bytesWritten: number; buffer: Uint8Array }>((resolve, reject) => {
        fs.write(fd, buffer, offset, length, position, (err, bytesWritten, buffer) => {
          if (err) {
            return reject(err);
          }

          return resolve({ bytesWritten, buffer });
        });
      });
  }

  get appendFile() {
    return promisify(fs.appendFile);
  }

  get fdatasync() {
    return promisify(fs.fdatasync);
  }
  get truncate() {
    return promisify(fs.truncate);
  }

  get rename() {
    return promisify(fs.rename);
  }
  get copyFile() {
    return promisify(fs.copyFile);
  }

  get open() {
    return promisify(fs.open);
  }
  get close() {
    return promisify(fs.close);
  }

  get symlink() {
    return promisify(fs.symlink);
  }
  get readlink() {
    return promisify(fs.readlink);
  }

  get chmod() {
    return promisify(fs.chmod);
  }

  get mkdir() {
    return promisify(fs.mkdir);
  }

  get unlink() {
    return promisify(fs.unlink);
  }
  get rmdir() {
    return promisify(fs.rmdir);
  }

  get realpath() {
    return promisify(fs.realpath);
  }

  async exists(path: string): Promise<boolean> {
    try {
      await Promises.access(path);

      return true;
    } catch {
      return false;
    }
  }

  //   get readdir() {
  //     return readdir;
  //   }
  //   get readDirsInDir() {
  //     return readDirsInDir;
  //   }

  //   get writeFile() {
  //     return writeFile;
  //   }

  //   get rm() {
  //     return rimraf;
  //   }

  //   get move() {
  //     return move;
  //   }
  //   get copy() {
  //     return copy;
  //   }
})();

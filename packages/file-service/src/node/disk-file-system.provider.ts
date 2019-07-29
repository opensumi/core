import * as fs from 'fs-extra';
import * as trash from 'trash';
import * as paths from 'path';
import * as os from 'os';
import * as mv from 'mv';
import { v4 } from 'uuid';
import Uri from 'vscode-uri';
import { sync as writeFileAtomicSync } from 'write-file-atomic';
import {
  Event,
  IDisposable,
  URI,
  Emitter,
} from '@ali/ide-core-common';
import { FileUri } from '@ali/ide-core-node';
import { NsfwFileSystemWatcherServer } from './file-service-watcher';
import {
  FileChangeEvent,
  FileStat,
  FileType,
  DidFilesChangedParams,
  FileSystemError,
  FileDeleteOptions,
  FileMoveOptions,
} from '../common/';

export abstract class FileSystemNodeOptions {

  public static DEFAULT: FileSystemNodeOptions = {
    encoding: 'utf8',
    overwrite: false,
    recursive: true,
    moveToTrash: true,
  };

  abstract encoding: string;
  abstract recursive: boolean;
  abstract overwrite: boolean;
  abstract moveToTrash: boolean;

}

function notEmpty<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function isErrnoException(error: any | NodeJS.ErrnoException): error is NodeJS.ErrnoException {
  return (error as NodeJS.ErrnoException).code !== undefined && (error as NodeJS.ErrnoException).errno !== undefined;
}

export class DiskFileSystemProvider {
  private options: FileSystemNodeOptions;
  private fileChangeEmitter = new Emitter<FileChangeEvent>();
  private; watcherServer: NsfwFileSystemWatcherServer = new NsfwFileSystemWatcherServer({
    verbose: true,
  });
  readonly onDidChangeFile: Event<FileChangeEvent> = this.fileChangeEmitter.event;

  constructor(options: FileSystemNodeOptions = FileSystemNodeOptions.DEFAULT) {
    this.options = options;
    this.watcherServer.setClient({
      onDidFilesChanged: (events: DidFilesChangedParams) => {
        this.fileChangeEmitter.fire(events.changes);
      },
    });
  }

  watch(uri: Uri | string): IDisposable {
    let watcherId;
    const watchPromise = this.watcherServer.watchFileChanges(new URI(uri).toString()).then((id) => watcherId = id);
    return {
      dispose: () => {
        if (!watcherId) {
          return watchPromise.then((id) => {
            this.watcherServer.unwatchFileChanges(id);
          });
        }
        this.watcherServer.unwatchFileChanges(watcherId);
      },
    };
  }

  stat(uri: Uri | string): FileStat | Thenable<FileStat> {
    const _uri = new URI(uri);
    return new Promise(async (resolve) => {
       this.doGetStat(_uri, 1)
        .then((stat) => resolve(stat))
        .catch((e) => resolve());
    });
  }

  readDirectory(uri: Uri | string): [string, FileType][] | Thenable<[string, FileType][]> {
    throw Error(`Not support readDirectory`);
  }

  async createDirectory(uri: Uri | string): Promise<FileStat> {
    const _uri = new URI(uri);
    const stat = await this.doGetStat(_uri, 0);
    if (stat) {
      if (stat.isDirectory) {
        return stat;
      }
      throw FileSystemError.FileExists(uri, 'Error occurred while creating the directory: path is a file.');
    }
    await fs.mkdirs(FileUri.fsPath(_uri));
    const newStat = await this.doGetStat(_uri, 1);
    if (newStat) {
      return newStat;
    }
    throw FileSystemError.FileNotFound(uri, 'Error occurred while creating the directory.');
  }

  readFile(uri: Uri | string): Promise<Buffer> {
    const _uri = new URI(uri);
    return fs.readFile(FileUri.fsPath(_uri));
  }

  async writeFile(
    uri: Uri | string,
    content: Buffer,
    options: { create: boolean, overwrite: boolean },
  ): Promise<void> {
    const _uri = new URI(uri);
    const exists = this.exists(uri);

    if (exists && !options.overwrite) {
      throw FileSystemError.FileExists(_uri.toString());
    } else if (!exists && !options.create) {
      throw FileSystemError.FileNotFound(_uri.toString());
    }

    await writeFileAtomicSync(FileUri.fsPath(_uri), content);
  }

  async exists(uri: Uri | string): Promise<boolean> {
    return fs.pathExists(FileUri.fsPath(new URI(uri)));
  }

  async delete(uri: string, options?: FileDeleteOptions): Promise<void> {
    const _uri = new URI(uri);
    const stat = await this.doGetStat(_uri, 0);
    if (!stat) {
      throw FileSystemError.FileNotFound(uri);
    }
    // Windows 10.
    // Deleting an empty directory throws `EPERM error` instead of `unlinkDir`.
    // https://github.com/paulmillr/chokidar/issues/566
    const moveToTrash = await this.doGetMoveToTrash(options);
    if (moveToTrash) {
      return trash([FileUri.fsPath(_uri)]);
    } else {
      const filePath = FileUri.fsPath(_uri);
      const outputRootPath = paths.join(os.tmpdir(), v4());
      try {
        await new Promise<void>((resolve, reject) => {
          fs.rename(filePath, outputRootPath, async (error) => {
            if (error) {
              return reject(error);
            }
            resolve();
          });
        });
        // There is no reason for the promise returned by this function not to resolve
        // as soon as the move is complete.  Clearing up the temporary files can be
        // done in the background.
        fs.remove(FileUri.fsPath(outputRootPath));
      } catch (error) {
        return fs.remove(filePath);
      }
    }
  }

  async rename(
    sourceUri: Uri | string,
    targetUri: Uri | string, options: { overwrite: boolean },
  ): Promise<FileStat> {
    const _sourceUri = new URI(sourceUri);
    const _targetUri = new URI(targetUri);
    // if (this.client) {
    //   this.client.onWillMove(sourceUri, targetUri);
    // }
    const result = await this.doMove(sourceUri.toString(), targetUri.toString(), options);
    // if (this.client) {
    //   this.client.onDidMove(sourceUri, targetUri);
    // }
    return result;
  }

  async copy(sourceUri: string, targetUri: string, options?: { overwrite?: boolean, recursive?: boolean }): Promise<FileStat> {
    const _sourceUri = new URI(sourceUri);
    const _targetUri = new URI(targetUri);
    const [sourceStat, targetStat, overwrite, recursive] = await Promise.all([
      this.doGetStat(_sourceUri, 0),
      this.doGetStat(_targetUri, 0),
      this.doGetOverwrite(options),
      this.doGetRecursive(options),
    ]);
    if (!sourceStat) {
      throw FileSystemError.FileNotFound(sourceUri);
    }
    if (targetStat && !overwrite) {
      throw FileSystemError.FileExists(targetUri, "Did you set the 'overwrite' flag to true?");
    }
    if (targetStat && targetStat.uri === sourceStat.uri) {
      throw FileSystemError.FileExists(targetUri, 'Cannot perform copy, source and destination are the same.');
    }
    await fs.copy(FileUri.fsPath(_sourceUri), FileUri.fsPath(_targetUri), { overwrite, recursive });
    const newStat = await this.doGetStat(_targetUri, 1);
    if (newStat) {
      return newStat;
    }
    throw FileSystemError.FileNotFound(targetUri, `Error occurred while copying ${sourceUri} to ${targetUri}.`);
  }

  // Protected or private

  protected async doGetOverwrite(option?: { overwrite?: boolean }): Promise<boolean | undefined> {
    return option && typeof (option.overwrite) !== 'undefined'
      ? option.overwrite
      : this.options.overwrite;
  }

  protected async doGetRecursive(option?: { recursive?: boolean }): Promise<boolean> {
    return option && typeof (option.recursive) !== 'undefined'
      ? option.recursive
      : this.options.recursive;
  }

  /**
   * Return `true` if it's possible for this URI to have children.
   * It might not be possible to be certain because of permission problems or other filesystem errors.
   */
  protected async mayHaveChildren(uri: URI): Promise<boolean> {
    /* If there's a problem reading the root directory. Assume it's not empty to avoid overwriting anything.  */
    try {
      const rootStat = await this.doGetStat(uri, 0);
      if (rootStat === undefined) {
        return true;
      }
      /* Not a directory.  */
      if (rootStat !== undefined && rootStat.isDirectory === false) {
        return false;
      }
    } catch (error) {
      return true;
    }

    /* If there's a problem with it's children then the directory must not be empty.  */
    try {
      const stat = await this.doGetStat(uri, 1);
      if (stat !== undefined && stat.children !== undefined) {
        return stat.children.length > 0;
      } else {
        return true;
      }
    } catch (error) {
      return true;
    }
  }

  protected async doMove(sourceUri: string, targetUri: string, options?: FileMoveOptions): Promise<FileStat> {
    const _sourceUri = new URI(sourceUri);
    const _targetUri = new URI(targetUri);
    const [sourceStat, targetStat, overwrite] = await Promise.all([this.doGetStat(_sourceUri, 1), this.doGetStat(_targetUri, 1), this.doGetOverwrite(options)]);
    if (!sourceStat) {
      throw FileSystemError.FileNotFound(sourceUri);
    }
    if (targetStat && !overwrite) {
      throw FileSystemError.FileExists(targetUri, "Did you set the 'overwrite' flag to true?");
    }

    // Different types. Files <-> Directory.
    if (targetStat && sourceStat.isDirectory !== targetStat.isDirectory) {
      if (targetStat.isDirectory) {
        throw FileSystemError.FileIsDirectory(targetStat.uri, `Cannot move '${sourceStat.uri}' file to an existing location.`);
      }
      throw FileSystemError.FileNotDirectory(targetStat.uri, `Cannot move '${sourceStat.uri}' directory to an existing location.`);
    }
    const [sourceMightHaveChildren, targetMightHaveChildren] = await Promise.all([this.mayHaveChildren(_sourceUri), this.mayHaveChildren(_targetUri)]);
    // Handling special Windows case when source and target resources are empty folders.
    // Source should be deleted and target should be touched.
    if (overwrite && targetStat && targetStat.isDirectory && sourceStat.isDirectory && !sourceMightHaveChildren && !targetMightHaveChildren) {
      // The value should be a Unix timestamp in seconds.
      // For example, `Date.now()` returns milliseconds, so it should be divided by `1000` before passing it in.
      const now = Date.now() / 1000;
      await fs.utimes(FileUri.fsPath(_targetUri), now, now);
      await fs.rmdir(FileUri.fsPath(_sourceUri));
      const newStat = await this.doGetStat(_targetUri, 1);
      if (newStat) {
        return newStat;
      }
      throw FileSystemError.FileNotFound(targetUri, `Error occurred when moving resource from '${sourceUri}' to '${targetUri}'.`);
    } else if (overwrite && targetStat && targetStat.isDirectory && sourceStat.isDirectory && !targetMightHaveChildren && sourceMightHaveChildren) {
      // Copy source to target, since target is empty. Then wipe the source content.
      const newStat = await this.copy(sourceUri, targetUri, { overwrite });
      await this.delete(sourceUri);
      return newStat;
    } else {
      return new Promise<FileStat>((resolve, reject) => {
        mv(FileUri.fsPath(_sourceUri), FileUri.fsPath(_targetUri), { mkdirp: true, clobber: overwrite }, async (error: any) => {
          if (error) {
            return reject(error);
          }
          resolve(await this.doGetStat(_targetUri, 1));
        });
      });
    }
  }

  protected async doGetMoveToTrash(option?: { moveToTrash?: boolean }): Promise<boolean> {
    return option && typeof (option.moveToTrash) !== 'undefined'
      ? option.moveToTrash
      : this.options.moveToTrash;
  }

  protected async doGetStat(uri: URI, depth: number): Promise<FileStat | undefined> {
    try {
      const filePath = FileUri.fsPath(uri);
      const lstat = await fs.lstat(filePath);

      if (lstat.isSymbolicLink()) {
        let realPath;
        try {
          realPath = await fs.realpath(FileUri.fsPath(uri));
        } catch (e) {
          return undefined;
        }
        const stat = await fs.stat(filePath);
        const realURI = FileUri.create(realPath);
        const realStat = await fs.lstat(realPath);

        let realStatData;
        if (stat.isDirectory()) {
          realStatData = await this.doCreateDirectoryStat(realURI, realStat, depth);
        } else {
          realStatData = await this.doCreateFileStat(realURI, realStat);
        }

        return {
          ...realStatData,
          isSymbolicLink: true,
          uri: uri.toString(),
        };

      } else {
        if (lstat.isDirectory()) {
          return await this.doCreateDirectoryStat(uri, lstat, depth);
        }
        const fileStat = await this.doCreateFileStat(uri, lstat);

        return fileStat;
      }

    } catch (error) {
      if (isErrnoException(error)) {
        if (error.code === 'ENOENT' || error.code === 'EACCES' || error.code === 'EBUSY' || error.code === 'EPERM') {
          return undefined;
        }
      }
      throw error;
    }
  }

  protected async doCreateFileStat(uri: URI, stat: fs.Stats): Promise<FileStat> {
    // Then stat the target and return that
    // const isLink = !!(stat && stat.isSymbolicLink());
    // if (isLink) {
    //   stat = await fs.stat(FileUri.fsPath(uri));
    // }

    return {
      uri: uri.toString(),
      lastModification: stat.mtime.getTime(),
      isSymbolicLink: stat.isSymbolicLink(),
      isDirectory: stat.isDirectory(),
      size: stat.size,
    };
  }

  protected async doCreateDirectoryStat(uri: URI, stat: fs.Stats, depth: number): Promise<FileStat> {
    const children = depth > 0 ? await this.doGetChildren(uri, depth) : [];
    return {
      uri: uri.toString(),
      lastModification: stat.mtime.getTime(),
      isDirectory: true,
      isSymbolicLink: stat.isSymbolicLink(),
      children,
    };
  }

  protected async doGetChildren(uri: URI, depth: number): Promise<FileStat[]> {
    const files = await fs.readdir(FileUri.fsPath(uri));
    const children = await Promise.all(files.map((fileName) => uri.resolve(fileName)).map((childUri) => this.doGetStat(childUri, depth - 1)));
    return children.filter(notEmpty);
  }
}

import paths from 'path';

import fs, { watch } from 'fs-extra';
import debounce from 'lodash/debounce';

import { Injectable, Optional } from '@opensumi/di';
import {
  FileUri,
  ParsedPattern,
  ILogService,
  ILogServiceManager,
  SupportLogNamespace,
  IDisposable,
  Disposable,
  DisposableCollection,
  isLinux,
  isWindows,
  isMacintosh,
  parseGlob,
} from '@opensumi/ide-core-node';
import { Promises } from '@opensumi/ide-utils/lib/pfs';

import { toDisposable } from '../../../../utils/src/disposable';
import { join, basename, dirname } from '../../../../utils/src/path';
// 文件监听类型(更新、添加、删除)；文件监听下的文件修改时触发事件；启动和注销文件监听
import {
  FileChangeType,
  FileSystemWatcherClient,
  IFileSystemWatcherServer,
  INsfw,
  WatchOptions,
} from '../../common/index';
import { FileChangeCollection } from '../file-change-collection';

export interface NoRecursiveEvent {
  path: string;
  type: 'added' | 'updated' | 'deleted';
}

export type NoRecursiveCallback = (err: Error | null, events: Event[]) => unknown;

export interface WatcherOptions {
  excludesPattern: ParsedPattern[]; // 函数，返回布尔值
  excludes: string[];
}

@Injectable({ multiple: true })
export class NoRecursiveFileSystemWatcher implements IFileSystemWatcherServer {
  recursive: false;

  private static readonly PARCEL_WATCHER_BACKEND = isWindows ? 'windows' : isLinux ? 'inotify' : 'fs-events';

  private WATCHER_HANDLERS = new Map<
    number,
    {
      path: string;
      handlers: any; // 暂时不确定
      disposable: IDisposable;
    }
  >();

  private static WATCHER_SEQUENCE = 1;

  protected watcherOptions = new Map<number, WatcherOptions>();

  private static readonly FILE_DELETE_HANDLER_DELAY = 100;

  // 一个symbol关键字，内容是ILogServiceManager
  private readonly loggerManager: ILogServiceManager;

  private logger: ILogService;

  // 收集发生改变的文件
  protected changes = new FileChangeCollection();

  protected readonly toDispose = new DisposableCollection(Disposable.create(() => this.setClient(undefined)));

  protected client: FileSystemWatcherClient | undefined;

  constructor(@Optional() private readonly excludes: string[] = []) {
    // this.logger = this.loggerManager.getLogger(SupportLogNamespace.Node);
  }

  dispose(): void {
    this.toDispose.dispose();
    this.WATCHER_HANDLERS.clear();
  }

  /**
   * 查找某个路径是否已被监听
   * @param watcherPath
   */
  checkIsAlreadyWatched(watcherPath: string): number | undefined {
    for (const [watcherId, watcher] of this.WATCHER_HANDLERS) {
      if (watcherPath.indexOf(watcher.path) === 0) {
        return watcherId;
      }
    }
  }

  private async doWatch(basePath: string) {
    try {
      // 创建监听对象
      const watcher = watch(basePath);

      // eslint-disable-next-line no-console
      console.log('start watching', basePath);

      // 文件夹的子目录
      const folderChildren = new Set<string>();

      // 判断是否是文件夹目录
      const isDirectory = fs.lstatSync(basePath).isDirectory();
      // 如果是文件夹目录
      if (isDirectory) {
        try {
          for (const child of fs.readdirSync(basePath)) {
            folderChildren.add(child);
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(error);
        }

        // 开始走监听流程
        watcher.on('error', (code: number, signal: string) => {
          // eslint-disable-next-line no-console
          console.error(`Failed to watch ${basePath} for changes using fs.watch() (${code}, ${signal})`);
          watcher.close();
        });

        // 监听到文件改变时候的回调函数
        watcher.on('change', (type, raw) => {
          const changePath = join(basePath, raw as string);

          let changeFileName = '';
          if (raw) {
            changeFileName = raw.toString();
            if (isMacintosh) {
              changeFileName = fs.realpathSync.native(changeFileName);
            }
          }

          if (!changeFileName || (type !== 'change' && type !== 'rename')) {
            return;
          }
          if (isDirectory) {
            if (type === 'rename') {
              const timeoutHandle = setTimeout(async () => {
                if (changeFileName === raw && !(await Promises.exists(basePath))) {
                  this.toDispose.dispose();
                  return;
                }
                const fileExists = await this.existsChildStrictCase(changePath);
                let type: FileChangeType;
                if (fileExists) {
                  if (folderChildren.has(changeFileName)) {
                    type = FileChangeType.UPDATED;
                    this.pushUpdated(changePath);
                  } else {
                    folderChildren.add(changeFileName);
                    type = FileChangeType.ADDED;
                    this.pushAdded(changePath);
                  }
                } else {
                  folderChildren.delete(changeFileName);
                  type = FileChangeType.DELETED;
                  this.pushDeleted(changePath);
                }
              }, NoRecursiveFileSystemWatcher.FILE_DELETE_HANDLER_DELAY);
              timeoutHandle;
            }

            // 文件子目录发生改变
            else {
              let type: FileChangeType;
              if (folderChildren.has(changeFileName)) {
                type = FileChangeType.UPDATED;
                this.pushUpdated(changePath);
              } else {
                folderChildren.add(changeFileName);
                type = FileChangeType.ADDED;
                this.pushAdded(changePath);
              }
            }
          }

          // 文件
          else {
            // TODO:这里的判断有待商榷
            if (type === 'rename' || changeFileName !== raw) {
              const timeoutHandle = setTimeout(async () => {
                const fileExists = await Promises.exists(changePath);

                if (fileExists) {
                  this.pushUpdated(changePath);
                } else {
                  this.pushDeleted(changePath);
                }
              }, NoRecursiveFileSystemWatcher.FILE_DELETE_HANDLER_DELAY);
              timeoutHandle;
            } else {
              this.pushUpdated(changePath);
            }
          }
        });
      }
    } catch (error) {
      if (await fs.pathExists(basePath)) {
        // eslint-disable-next-line no-console
        console.error(`Failed to watch ${basePath} for change using fs.watch() (${error.toString()})`);
      }
    }
  }

  /**
   * @param uri
   * @param options
   */
  async watchFileChanges(uri: string, options?: WatchOptions) {
    const basePath = FileUri.fsPath(uri);
    const exist = await fs.pathExists(basePath);

    let watcherId = this.checkIsAlreadyWatched(basePath);

    if (watcherId) {
      return watcherId;
    }

    watcherId = NoRecursiveFileSystemWatcher.WATCHER_SEQUENCE++;

    const disposables = new DisposableCollection(); // 管理可释放的资源

    let watchPath = '';

    if (exist) {
      const stat = await fs.lstatSync(basePath);
      if (stat && stat.isDirectory()) {
        watchPath = basePath;
      } else {
        // eslint-disable-next-line no-console
        console.log('此路径不存在，请重新开始');
      }
    } else {
      // eslint-disable-next-line no-console
      console.log('此路径不存在，请重新开始');
    }
    disposables.push(await this.start(watcherId, watchPath, options));
    this.toDispose.push(disposables);
    return watcherId;
  }

  /**
   * 过滤 `write-file-atomic` 写入生成的临时文件
   * @param events
   */
  protected trimChangeEvent(events: NoRecursiveEvent[]): NoRecursiveEvent[] {
    events = events.filter((event: NoRecursiveEvent) => {
      if (event.path) {
        if (/\.\d{7}\d+$/.test(event.path)) {
          // write-file-atomic 源文件xxx.xx 对应的临时文件为 xxx.xx.22243434
          // 这类文件的更新应当完全隐藏掉
          return false;
        }
      }
      return true;
    });

    return events;
  }

  private getDefaultWatchExclude() {
    return ['**/.git/objects/**', '**/.git/subtree-cache/**', '**/node_modules/**/*', '**/.hg/store/**'];
  }

  protected async start(
    watcherId: number,
    basePath: string,
    rawOptions: WatchOptions | undefined, // WatchOptions指定哪些项不应该被监视或考虑在内
  ): Promise<DisposableCollection> {
    const disposables = new DisposableCollection();
    if (!(await fs.pathExists(basePath))) {
      return disposables;
    }

    const realPath = await fs.realpath(basePath);
    const tryWatchDir = async (maxRetries = 3, retryDelay = 1000) => {
      for (let times = 0; times < maxRetries; times++) {
        try {
          this.doWatch(realPath);
        } catch (error) {
          await new Promise((resolve) => {
            setTimeout(resolve, retryDelay);
          });
        }
      }

      // eslint-disable-next-line no-console
      console.error(`watcher finally failed after ${maxRetries} times`);
      return undefined;
    };

    if (this.isEnableNSFW()) {
      const nsfw = await this.withNSFWModule();
      const watcher: INsfw.NSFW = await nsfw(
        realPath,
        (events: INsfw.ChangeEvent[]) => this.handleNSFWEvents(events, watcherId),
        {
          errorCallback: (error: any) => {
            // eslint-disable-next-line no-console
            console.warn(`Failed to watch "${basePath}":`, error);
            this.unwatchFileChanges(watcherId);
          },
        },
      );

      await watcher.start();

      disposables.push(
        Disposable.create(async () => {
          this.watcherOptions.delete(watcherId);
          await watcher.stop();
        }),
      );

      const excludes = this.excludes.concat(rawOptions?.excludes || this.getDefaultWatchExclude());

      this.watcherOptions.set(watcherId, {
        excludesPattern: excludes.map((pattern) => parseGlob(pattern)),
        excludes,
      });
    } else {
      const handler = await tryWatchDir();

      // 但是这里始终为undefined
      if (handler) {
        disposables.push(
          Disposable.create(async () => {
            if (handler) {
            }
          }),
        );
      }
    }

    return disposables;
  }

  unwatchFileChanges(watcherId: number): Promise<void> {
    const watcher = this.WATCHER_HANDLERS.get(watcherId);
    if (watcher) {
      this.WATCHER_HANDLERS.delete(watcherId);
      watcher.disposable.dispose();
    }
    return Promise.resolve();
  }

  /**
   * 返回的boolean值
   */
  private async existsChildStrictCase(path: string): Promise<boolean> {
    if (isLinux) {
      return Promises.exists(path);
    }
    try {
      const pathBasename = basename(path);
      const children = fs.readdirSync(dirname(path));

      return children.some((child) => child === pathBasename);
    } catch (error) {
      /**
       * 输出日志
       */
      // eslint-disable-next-line no-console
      console.trace(error);
      return false;
    }
  }

  private async withNSFWModule(): Promise<typeof import('nsfw')> {
    return require('nsfw');
  }

  protected pushAdded(path: string): void {
    this.pushFileChange(path, FileChangeType.ADDED);
  }

  protected pushUpdated(path: string): void {
    this.pushFileChange(path, FileChangeType.UPDATED);
  }

  protected pushDeleted(path: string): void {
    this.pushFileChange(path, FileChangeType.DELETED);
  }

  protected pushFileChange(path: string, type: FileChangeType): void {
    const uri = FileUri.create(path).toString();
    this.changes.push({ uri, type });

    this.fireDidFilesChanged();
  }

  /**
   * Fires file changes to clients.
   * It is debounced in the case if the filesystem is spamming to avoid overwhelming clients with events.
   */
  protected readonly fireDidFilesChanged: () => void = debounce(() => this.doFireDidFilesChanged(), 100);

  protected doFireDidFilesChanged(): void {
    const changes = this.changes.values();
    this.changes = new FileChangeCollection();
    const event = { changes };
    if (this.client) {
      this.client.onDidFilesChanged(event);
    }
  }

  setClient(client: FileSystemWatcherClient | undefined) {
    if (client && this.toDispose.disposed) {
      return;
    }
    this.client = client;
  }

  private isEnableNSFW(): boolean {
    return isLinux;
  }

  private async handleNSFWEvents(events: INsfw.ChangeEvent[], watcherId: number): Promise<void> {
    const isIgnored = (watcherId: number, path: string): boolean => {
      const options = this.watcherOptions.get(watcherId);
      if (!options || !options.excludes || options.excludes.length < 1) {
        return false;
      }
      return options.excludesPattern.some((match) => match(path));
    };

    if (events.length > 5000) {
      return;
    }

    for (const event of events) {
      if (event.action === INsfw.actions.RENAMED) {
        const deletedPath = this.resolvePath(event.directory, event.oldFile!);
        if (isIgnored(watcherId, deletedPath)) {
          continue;
        }

        this.pushDeleted(deletedPath);

        if (event.newDirectory) {
          const path = this.resolvePath(event.newDirectory, event.newFile!);
          if (isIgnored(watcherId, path)) {
            continue;
          }

          this.pushAdded(path);
        } else {
          const path = this.resolvePath(event.directory, event.newFile!);
          if (isIgnored(watcherId, path)) {
            continue;
          }

          this.pushAdded(path);
        }
      } else {
        const path = this.resolvePath(event.directory, event.file!);
        if (isIgnored(watcherId, path)) {
          continue;
        }

        if (event.action === INsfw.actions.CREATED) {
          this.pushAdded(path);
        }
        if (event.action === INsfw.actions.DELETED) {
          this.pushDeleted(path);
        }
        if (event.action === INsfw.actions.MODIFIED) {
          this.pushUpdated(path);
        }
      }
    }
  }

  protected resolvePath(directory: string, file: string): string {
    const path = paths.join(directory, file);
    // 如果是 linux 则获取一下真实 path，以防返回的是软连路径被过滤
    if (isLinux) {
      try {
        return fs.realpathSync.native(path);
      } catch (_e) {
        try {
          // file does not exist try to resolve directory
          return paths.join(fs.realpathSync.native(directory), file);
        } catch (_e) {
          // directory does not exist fall back to symlink
          return path;
        }
      }
    }
    return path;
  }
}

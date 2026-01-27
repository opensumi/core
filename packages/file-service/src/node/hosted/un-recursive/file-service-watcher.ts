import fs, { watch } from 'fs-extra';
import debounce from 'lodash/debounce';

import { ILogService } from '@opensumi/ide-core-common/lib/log';
import { Disposable, DisposableCollection, FileUri, isMacintosh, path } from '@opensumi/ide-utils/lib';

import { FileChangeType, FileSystemWatcherClient, IWatcher } from '../../../common/index';
import { FileChangeCollection } from '../../file-change-collection';
import { shouldIgnorePath } from '../shared';
const { join, basename, normalize } = path;

export class UnRecursiveFileSystemWatcher implements IWatcher {
  private watcherCollections: Map<string, fs.FSWatcher> = new Map();

  private static readonly FILE_DELETE_HANDLER_DELAY = 500;

  // 收集发生改变的文件
  protected changes = new FileChangeCollection();

  protected readonly toDispose = new DisposableCollection(Disposable.create(() => this.setClient(undefined)));

  protected client: FileSystemWatcherClient | undefined;

  constructor(private readonly logger: ILogService) {}

  dispose(): void {
    // 先关闭所有 watcher
    for (const [, watcher] of this.watcherCollections) {
      try {
        watcher.close();
      } catch (error) {
        this.logger.error('[Un-Recursive] Error closing watcher during dispose:', error);
      }
    }
    this.watcherCollections.clear();
    this.toDispose.dispose();
  }

  /**
   * 创建文件监听器
   * @param basePath 要监听的路径
   * @returns 创建的 watcher，如果失败则返回 undefined
   */
  private async doWatch(basePath: string): Promise<fs.FSWatcher | undefined> {
    try {
      const watcher = watch(basePath);
      this.logger.log('[Un-Recursive] start watching', basePath);

      // 将 watcher 加入 collections
      this.watcherCollections.set(basePath, watcher);

      const stat = await fs.lstat(basePath);
      const isDirectory = stat.isDirectory();

      const docChildren = new Set<string>();
      let signalDoc = '';
      if (isDirectory) {
        try {
          const children = await fs.readdir(basePath);
          for (const child of children) {
            const base = join(basePath, String(child));
            const childStat = await fs.lstat(base);
            if (!childStat.isDirectory()) {
              docChildren.add(child);
            }
          }
        } catch (error) {
          this.logger.error(error);
        }
      } else {
        signalDoc = basename(basePath);
      }

      // 开始走监听流程
      watcher.on('error', (code: number, signal: string) => {
        this.logger.error(
          `[Un-Recursive] Failed to watch ${basePath} for changes using fs.watch() (${code}, ${signal})`,
        );
        watcher.close();
        // 从 collections 中移除
        this.watcherCollections.delete(basePath);
      });

      watcher.on('change', (type: string, filename: string | Buffer) => {
        if (shouldIgnorePath(filename as string)) {
          return;
        }

        // 对传入的raw做一个统一处理
        let changeFileName = '';
        if (filename) {
          changeFileName = filename as string;
          if (isMacintosh) {
            changeFileName = normalize(changeFileName);
          }
        }
        if (!filename || (type !== 'change' && type !== 'rename')) {
          return;
        }

        const changePath = join(basePath, changeFileName);
        if (isDirectory) {
          setTimeout(async () => {
            // 检查是否已销毁，避免在销毁后执行
            if (this.toDispose.disposed) {
              return;
            }
            // 监听的目录如果是文件夹，那么只对其下面的文件改动做出响应
            if (docChildren.has(changeFileName)) {
              if ((type === 'rename' || type === 'change') && changeFileName === filename) {
                const fileExists = await fs.pathExists(changePath);
                if (fileExists) {
                  this.pushUpdated(changePath);
                } else {
                  docChildren.delete(changeFileName);
                  this.pushDeleted(changePath);
                }
              }
            } else if (await fs.pathExists(changePath)) {
              const changeStat = await fs.lstat(changePath);
              if (!changeStat.isDirectory()) {
                this.pushAdded(changePath);
                docChildren.add(changeFileName);
              }
            }
          }, UnRecursiveFileSystemWatcher.FILE_DELETE_HANDLER_DELAY);
        } else {
          setTimeout(async () => {
            // 检查是否已销毁，避免在销毁后执行
            if (this.toDispose.disposed) {
              return;
            }
            if (changeFileName === signalDoc) {
              if (await fs.pathExists(basePath)) {
                this.pushUpdated(basePath);
              } else {
                this.pushDeleted(basePath);
                signalDoc = '';
              }
            }
          }, UnRecursiveFileSystemWatcher.FILE_DELETE_HANDLER_DELAY);
        }
      });

      return watcher;
    } catch (error) {
      this.logger.error(`[Un-Recursive] Failed to watch ${basePath} for change using fs.watch() (${error.toString()})`);
      // 清理已注册的 watcher，避免资源泄漏
      const existingWatcher = this.watcherCollections.get(basePath);
      if (existingWatcher) {
        try {
          existingWatcher.close();
        } catch {
          // ignore close error
        }
        this.watcherCollections.delete(basePath);
      }
      return undefined;
    }
  }

  async watchFileChanges(uri: string) {
    const basePath = FileUri.fsPath(uri);
    const exist = await fs.pathExists(basePath);

    const disposables = new DisposableCollection(); // 管理可释放的资源

    let watchPath = '';

    if (exist) {
      const stat = await fs.lstat(basePath);
      if (stat) {
        watchPath = basePath;
      }
    } else {
      this.logger.warn('[Un-Recursive] This path does not exist. Please try again');
    }
    disposables.push(await this.start(watchPath));
    this.toDispose.push(disposables);
  }

  protected async start(basePath: string): Promise<DisposableCollection> {
    const disposables = new DisposableCollection();
    if (!(await fs.pathExists(basePath))) {
      return disposables;
    }

    const realPath = await fs.realpath(basePath);
    if (this.watcherCollections.has(realPath)) {
      return disposables;
    }

    const watcher = await this.doWatch(realPath);

    if (watcher) {
      disposables.push(
        Disposable.create(() => {
          try {
            watcher.close();
            this.watcherCollections.delete(realPath);
            this.logger.log('[Un-Recursive] stop watching via disposable', realPath);
          } catch (error) {
            this.logger.error('[Un-Recursive] Error closing watcher:', error);
          }
        }),
      );
    }

    return disposables;
  }

  unwatchFileChanges(uri: string): void {
    const basePath = FileUri.fsPath(uri);

    // 尝试解析 realPath，保持与 start 方法一致
    let realPath = basePath;
    try {
      realPath = fs.realpathSync(basePath);
    } catch {
      // 如果解析失败（如路径不存在），使用原始路径
    }

    // 尝试使用 realPath 和 basePath 两种方式查找
    const pathToClose = this.watcherCollections.has(realPath) ? realPath : basePath;

    if (this.watcherCollections.has(pathToClose)) {
      const watcher = this.watcherCollections.get(pathToClose);
      watcher?.close();
      this.watcherCollections.delete(pathToClose);
      this.logger.log('[Un-Recursive] stop watching', pathToClose);
    }
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
    if (this.client && this.toDispose.disposed) {
      return;
    }
    this.client = client;
  }
}

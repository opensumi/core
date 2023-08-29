import { watch } from 'fs';
import fs from 'fs';

import {
  Disposable,
  ILogService,
  ILogServiceManager,
  SupportLogNamespace,
  IDisposable,
  DisposableStore,
} from '@opensumi/ide-core-common';
import { Promises } from '@opensumi/ide-utils/lib/pfs';

import { toDisposable } from '../../../../utils/src/disposable';
// 文件监听类型(更新、添加、删除)；文件监听下的文件修改时触发事件；启动和注销文件监听；
import {
  FileChangeType,
  FileSystemWatcherClient,
  IFileSystemWatcherServer,
  INsfw,
  WatchOptions,
} from '../../common/index';
import { IRecursiveWatchRequest } from '../../common/watcher';

export class NoRecursiveFileSystemWatcher {
  // 一个symbol关键字，内容是ILogServiceManager
  private readonly loggerManager: ILogServiceManager;
  private logger: ILogService;
  constructor() {
    this.logger = this.loggerManager.getLogger(SupportLogNamespace.Node);
  }

  private async watch() {
    try {
      // 里面需要调用watchFileChanges
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.error(error);
      } else {
        // eslint-disable-next-line no-console
        console.trace(error);
      }
    }
  }

  /**
   * 路径合理化
   */
  private async normalizePath(request: IRecursiveWatchRequest) {
    let realPath = request.path;
    try {
    } catch (error) {
      // ignore
    }
    return realPath;
  }
  /**
   * 可以类比一下vscode中的doWatch这个方法
   * @param uri
   * @param options
   */
  async watchFileChanges(uri: string, isDirectory: boolean) {
    const disposables = new DisposableStore();

    try {
      // 创建监听对象
      const watcher = watch(uri);
      disposables.add(
        toDisposable(() => {
          // TODO检测到错误就退出监听
        }),
      );

      // eslint-disable-next-line no-console
      console.trace(`Start watching: '${uri}'`);

      // 文件夹的子目录
      const folderChildren = new Set<string>();

      // 如果是文件夹目录
      if (isDirectory) {
        try {
          // TODO重写Promisify
          for (const child of fs.readdirSync(uri)) {
            folderChildren.add(child);
          }
        } catch (error) {
          this.logger.error(error);
        }

        disposables.add(
          toDisposable(() => {
            // TODO完成添加功能
          }),
        );

        // 开始走监听流程
        watcher.on('error', (code: number, signal: string) => {
          this.logger.error(`Failed to watch ${uri} for changes using fs.watch() (${code}, ${signal})`);
          // TODO退出监听还是什么流程呢，弄清楚再写
        });

        // 监听到文件改变时候的回调函数
        watcher.on('change', (type, raw) => {
          // eslint-disable-next-line no-console
          console.trace(`[raw] ["${type}"] ${type}`);

          let changeFileName = '';
          if (raw) {
            changeFileName = raw.toString();
            // TODO判断
          }

          if (!changeFileName || (type !== 'change' && type !== 'rename')) {
            return;
          }

          if (isDirectory) {
            if (type === 'rename') {
              // TODO需要延迟查看文件是否存在于磁盘上，然后确定下一步的动作
              const timeoutHandle = setTimeout(async () => {
                // TODO这里的判断有待商榷
                if (changeFileName === uri && !(await Promises.exists(uri))) {
                  this.logger.warn('watcher shutdown because watched path got deleted');
                  // TODO清除监听

                  return;
                }

                // TODO为了在不区分大小写的文件系统上正确检测重命名
                let fileExists: any;

                let type: FileChangeType;
                if (fileExists) {
                  if (folderChildren.has(changeFileName)) {
                    type = FileChangeType.UPDATED;
                  } else {
                    type = FileChangeType.ADDED;
                    folderChildren.add(changeFileName);
                  }
                } else {
                  folderChildren.delete(changeFileName);
                  type = FileChangeType.DELETED;
                }

                // TODO：onFileChange
              }, 0);
            }

            // 文件子目录发生变化
            else {
              let type: FileChangeType;
              if (folderChildren.has(changeFileName)) {
                type = FileChangeType.UPDATED;
              } else {
                type = FileChangeType.ADDED;
                folderChildren.add(changeFileName);
              }

              // TODO:onFileChange
            }
          } else {
            // TODO:这里的判断有待商榷
            if (type === 'rename' || changeFileName !== uri) {
              const timeoutHandle = setTimeout(async () => {
                const fileExists = await Promises.exists(uri);

                if (fileExists) {
                  // TODO:onFileChange-disposables.add
                } else {
                  // TODO:onFileChange-disposables.add
                }
              });
            } else {
              // TODO:onFileChange-disposables.add
            }
          }
        });
      }
    } catch (error) {
      // TODO
    }
  }
}

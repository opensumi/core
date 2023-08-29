import { watch } from 'fs';

import {
  Disposable,
  ILogService,
  ILogServiceManager,
  SupportLogNamespace,
  IDisposable,
  DisposableStore,
} from '@opensumi/ide-core-common';

// 文件监听类型(更新、添加、删除)；文件监听下的文件修改时触发事件；启动和注销文件监听；
import {
  FileChangeType,
  FileSystemWatcherClient,
  IFileSystemWatcherServer,
  INsfw,
  WatchOptions,
} from '../../common/index';
import { IRecursiveWatchRequest } from '../../common/watcher';
import { FileChangeCollection } from '../file-change-collection';

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
    } catch (error) {}
  }
}

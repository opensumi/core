import { Injectable, Autowired } from '@ali/common-di';
import { IDisposable, Disposable, URI, Emitter, Event } from '@ali/ide-core-common';
import { FileChangeEvent, DidFilesChangedParams, FileChange } from '../common/file-service-watcher-protocol';
import { FileWatcherServicePath } from '../common';

@Injectable()
export class FileServiceWatcherClient {
  protected readonly onFileChangedEmitter = new Emitter<FileChangeEvent>();
  readonly onFilesChanged: Event<FileChangeEvent> = this.onFileChangedEmitter.event;

  @Autowired(FileWatcherServicePath)
  private fileWatcherService;

  onDidFilesChanged(event: DidFilesChangedParams): void {
    const changes: FileChange[] = event.changes.map((change) => {
      return {
        uri: change.uri,
        type: change.type,
      } as FileChange;
    });
    this.onFileChangedEmitter.fire(changes);
  }

  // 添加监听文件
  async watchFileChanges(uri: URI): Promise<IDisposable> {
    const watcher = await this.fileWatcherService.watchFileChanges(uri);
    const toDispose = Disposable.create(() => {
      this.fileWatcherService.unwatchFileChanges(watcher);
    });
    return toDispose;
  }
}

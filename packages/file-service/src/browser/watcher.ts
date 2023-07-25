import { Event, Emitter, DisposableCollection, URI } from '@opensumi/ide-core-common';

import { IFileServiceClient, IFileServiceWatcher, FileServiceWatcherOptions, FileChange } from '../common';

function filterChange(fileChangeList: FileChange[], watchUri: string) {
  return fileChangeList.filter((fileChange) => {
    if (fileChange.uri.startsWith(watchUri)) {
      return true;
    }
    return false;
  });
}

export class FileSystemWatcher implements IFileServiceWatcher {
  private readonly toDispose = new DisposableCollection();
  private readonly fileServiceClient: IFileServiceClient;
  private uri: URI;
  watchId: number;

  protected changeEmitter = new Emitter<FileChange[]>();

  constructor(options: FileServiceWatcherOptions) {
    this.toDispose.push(this.changeEmitter);
    this.fileServiceClient = options.fileServiceClient;
    this.watchId = options.watchId;
    this.uri = options.uri;

    this.fileServiceClient.onFilesChanged((fileChangeList: FileChange[]) => {
      const result = filterChange(fileChangeList, this.uri.toString());
      if (result && result.length > 0) {
        this.changeEmitter.fire(result);
      }
    });
  }

  get onFilesChanged(): Event<FileChange[]> {
    return this.changeEmitter.event;
  }

  dispose() {
    return Promise.all<void>([
      this.toDispose.dispose(),
      this.fileServiceClient.unwatchFileChanges(this.watchId),
    ]) as any;
  }

  isDisposed() {
    return this.toDispose.disposed;
  }
}

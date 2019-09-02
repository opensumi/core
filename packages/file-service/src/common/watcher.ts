import { IFileServiceClient } from './file-service-client';
import { FileChange } from './file-service-watcher-protocol';
import { URI, Event } from '@ali/ide-core-common';

export interface FileServiceWatcherOptions {
  fileServiceClient: IFileServiceClient;
  watchId: number;
  uri: URI;
}

export interface IFileServiceWatcher {
  watchId: number;
  onFilesChanged: Event<FileChange[]>;
  dispose(): void;
}

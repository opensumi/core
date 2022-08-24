import { URI, Event, FileChange } from '@opensumi/ide-core-common';

import { IFileServiceClient } from './file-service-client';

export interface FileServiceWatcherOptions {
  fileServiceClient: IFileServiceClient;
  watchId: number;
  uri: URI;
}

export interface IFileServiceWatcher {
  watchId: number;
  onFilesChanged: Event<FileChange[]>;
  dispose(): Promise<void>;
}

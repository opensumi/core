import { FileChange, RefCountedDisposable } from '@opensumi/ide-core-common';

export const WatchInsData = 'WatchIns';
export interface WatchInsData {
  watcherId: number;
  path: string;

  disposable: RefCountedDisposable;
}

export const FileChangeData = 'FileChange';
export interface FileChangeData {
  changes: FileChange[];
}

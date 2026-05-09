import {
  BasicEvent,
  FileChange,
  FileSystemProvider,
  FileWatcherFailureParams,
  FileWatcherOverflowParams,
  IDisposable,
} from '@opensumi/ide-core-common';

export class FilesChangeEvent extends BasicEvent<FileChange[]> {}
export class FileWatcherOverflowEvent extends BasicEvent<FileWatcherOverflowParams> {}
export class FileWatcherFailureEvent extends BasicEvent<FileWatcherFailureParams> {}

export interface FsProviderContribution {
  registerProvider?(registry: {
    registerProvider(scheme: string, provider: FileSystemProvider): IDisposable;
  }): void | Promise<void>;
  onFileServiceReady?(): void | Promise<void>;
}

export const FsProviderContribution = Symbol('FsProviderContribution');

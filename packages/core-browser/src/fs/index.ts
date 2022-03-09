import { FileSystemProvider, IDisposable, FileChange } from '@opensumi/ide-core-common';

import { BasicEvent } from '..';

export class FilesChangeEvent extends BasicEvent<FileChange[]> {}

export interface FsProviderContribution {
  registerProvider?(registry: {
    registerProvider(scheme: string, provider: FileSystemProvider): IDisposable;
  }): void | Promise<void>;
  onFileServiceReady?(): void | Promise<void>;
}

export const FsProviderContribution = Symbol('FsProviderContribution');

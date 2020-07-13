import { FileSystemProvider, IDisposable, FileChange } from '@ali/ide-core-common';
import { BasicEvent } from '..';

export class FilesChangeEvent extends BasicEvent<FileChange[]> {}

export interface FsProviderContribution {
  registerProvider?(registry: { registerProvider(scheme: string, provider: FileSystemProvider): IDisposable }): void;
  onFileServiceReady?(): void;
}

export const FsProviderContribution = Symbol('FsProviderContribution');

import { BasicEvent } from '..';
import { IFileServiceClient } from '@ali/ide-file-service';

export interface FileChange {
  uri: string;
  type: FileChangeType;
}

export enum FileChangeType {
  UPDATED = 0,
  ADDED = 1,
  DELETED = 2,
}

export class FilesChangeEvent extends BasicEvent<FileChange[]> {}

export interface FsProviderContribution {
  registerProvider?(registry: IFileServiceClient): void;
  onFileServiceReady?(): void;
}

export const FsProviderContribution = Symbol('FsProviderContribution');

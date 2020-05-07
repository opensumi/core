import { BasicEvent } from '..';

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

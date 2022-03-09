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
  dispose(): void;
}

export type INsfwFunction = (
  dir: string,
  eventHandler: (events: INsfw.ChangeEvent[]) => void,
  options?: INsfw.Options,
) => Promise<INsfw.NSFW>;

export namespace INsfw {
  export interface NSFW {
    start(): Promise<void>;
    stop(): Promise<void>;
  }

  export interface Options {
    debounceMS?: number;
    errorCallback?: (error: string) => void;
  }

  export interface ChangeEvent {
    action: number;
    directory: string;
    file?: string;
    oldFile?: string;
    newFile?: string;
    newDirectory?: string;
  }

  export enum actions {
    CREATED,
    DELETED,
    MODIFIED,
    RENAMED,
  }
}

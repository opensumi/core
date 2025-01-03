import { ProxyIdentifier } from '@opensumi/ide-connection/lib/common/rpc/multiplexer';
import { Event, FileChange, IRelativePattern, URI, UriComponents } from '@opensumi/ide-core-common';
import {
  DidFilesChangedParams,
  FileSystemWatcherClient,
  RecursiveWatcherBackend,
} from '@opensumi/ide-core-common/lib/types/file-watch';

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

export interface IRecursiveWatchRequest {
  path: string;
  recursive: boolean;
  excludes?: Array<string | IRelativePattern>;
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

export const SUMI_WATCHER_PROCESS_SOCK_KEY = 'sumi-watcher-process-sock';
export const WATCHER_INIT_DATA_KEY = 'sumi-watcher-init-data';

export interface IWatcherHostService {
  $watch(uri: UriComponents, options?: { excludes?: string[]; recursive?: boolean }): Promise<number>;
  $unwatch(watchId: number): Promise<void>;
  $setWatcherFileExcludes(excludes: string[]): Promise<void>;
  $dispose(): Promise<void>;

  initWatcherServer(): void;
}

export const WatcherServiceProxy = new ProxyIdentifier('WatcherHostServiceImpl');

export const WatcherProcessManagerProxy = new ProxyIdentifier('WatcherProcessManagerProxy');

export interface IWatcherProcessManager {
  whenReady: Promise<void>;

  createProcess(clientId: string, backend?: RecursiveWatcherBackend): Promise<number | undefined>;
  setClient(client: FileSystemWatcherClient): void;
  dispose(): Promise<void>;

  watch(
    uri: UriComponents,
    options?: { excludes?: string[]; recursive?: boolean; pollingWatch?: boolean },
  ): Promise<number>;
  unWatch(watcherId: number): Promise<void>;
  setWatcherFileExcludes(excludes: string[]): Promise<void>;

  $onDidFilesChanged(events: DidFilesChangedParams): void;
}

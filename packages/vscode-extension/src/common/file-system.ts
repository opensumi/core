import * as vscode from 'vscode';
import { Event } from '@ali/ide-core-common';
import { FileChangeEvent } from '@ali/ide-file-service';
import { FileChange } from '@ali/ide-file-service';
import { ParsedPattern } from './glob';

// tslint:disable-next-line:no-empty-interface
export interface IMainThreadFileSystem {
  $subscribeWatcher(options: FileSystemWatcherOptions): number;
  $unsubscribeWatcher(id: number);
}

export interface IExtHostFileSystem {
  onDidChange: Event<FilechangeEventInfo>;
  $onFileEvent(options: FilechangeEventInfo);

  subscribeWatcher(options: FileSystemWatcherOptions): Promise<number>;
  unsubscribeWatcher(id: number): Promise<void>;
}

export interface FilechangeEventInfo {
  id: number;
  event: FileChange;
}

export interface FileSystemWatcherOptions {
  globPattern: vscode.GlobPattern;
  ignoreCreateEvents: boolean;
  ignoreChangeEvents: boolean;
  ignoreDeleteEvents: boolean;
}

export interface FileWatcherSubscriber {
  id: number;
  mather: ParsedPattern;
  ignoreCreateEvents: boolean;
  ignoreChangeEvents: boolean;
  ignoreDeleteEvents: boolean;
}

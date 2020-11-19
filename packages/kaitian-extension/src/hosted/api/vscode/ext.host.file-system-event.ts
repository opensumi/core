import { Event, Emitter, Disposable, URI } from '@ali/ide-core-common';
import type * as vscode from 'vscode';
import { FileSystemEvents, IExtHostFileSystemEvent } from '../../../common/vscode/file-system';
import { IRelativePattern, parse } from '../../../common/vscode/glob';

class FileSystemWatcher implements vscode.FileSystemWatcher {

  private readonly _onDidCreate = new Emitter<vscode.Uri>();
  private readonly _onDidChange = new Emitter<vscode.Uri>();
  private readonly _onDidDelete = new Emitter<vscode.Uri>();
  private _disposable: Disposable;
  private _config: number;

  get ignoreCreateEvents(): boolean {
    return Boolean(this._config & 0b001);
  }

  get ignoreChangeEvents(): boolean {
    return Boolean(this._config & 0b010);
  }

  get ignoreDeleteEvents(): boolean {
    return Boolean(this._config & 0b100);
  }

  constructor(dispatcher: Event<FileSystemEvents>, globPattern: string | IRelativePattern, ignoreCreateEvents?: boolean, ignoreChangeEvents?: boolean, ignoreDeleteEvents?: boolean) {

    this._config = 0;
    if (ignoreCreateEvents) {
      this._config += 0b001;
    }
    if (ignoreChangeEvents) {
      this._config += 0b010;
    }
    if (ignoreDeleteEvents) {
      this._config += 0b100;
    }

    const parsedPattern = parse(globPattern);

    const subscription = dispatcher((events) => {
      if (!ignoreCreateEvents) {
        for (const created of events.created) {
          const uri = URI.revive(created);
          if (parsedPattern(uri.fsPath)) {
            this._onDidCreate.fire(uri);
          }
        }
      }
      if (!ignoreChangeEvents) {
        for (const changed of events.changed) {
          const uri = URI.revive(changed);
          if (parsedPattern(uri.fsPath)) {
            this._onDidChange.fire(uri);
          }
        }
      }
      if (!ignoreDeleteEvents) {
        for (const deleted of events.deleted) {
          const uri = URI.revive(deleted);
          if (parsedPattern(uri.fsPath)) {
            this._onDidDelete.fire(uri);
          }
        }
      }
    });

    this._disposable = new Disposable(this._onDidCreate, this._onDidChange, this._onDidDelete, subscription);
  }

  dispose() {
    this._disposable.dispose();
  }

  get onDidCreate(): Event<vscode.Uri> {
    return this._onDidCreate.event;
  }

  get onDidChange(): Event<vscode.Uri> {
    return this._onDidChange.event;
  }

  get onDidDelete(): Event<vscode.Uri> {
    return this._onDidDelete.event;
  }
}

export class ExtHostFileSystemEvent implements IExtHostFileSystemEvent {

  private readonly _onFileSystemEvent = new Emitter<FileSystemEvents>();

  ExtHostFileSystemEvent() {
    //
  }

  // --- file events

  createFileSystemWatcher(globPattern: string | IRelativePattern, ignoreCreateEvents?: boolean, ignoreChangeEvents?: boolean, ignoreDeleteEvents?: boolean): vscode.FileSystemWatcher {
    return new FileSystemWatcher(this._onFileSystemEvent.event, globPattern, ignoreCreateEvents, ignoreChangeEvents, ignoreDeleteEvents);
  }

  $onFileEvent(events: FileSystemEvents) {
    this._onFileSystemEvent.fire(events);
  }

}

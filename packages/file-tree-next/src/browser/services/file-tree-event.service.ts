import { Injectable } from '@opensumi/di';
import { Emitter, Event, FilesChangeEvent, OnEvent, WithEventBus } from '@opensumi/ide-core-browser';

@Injectable()
export class FileTreeEventService extends WithEventBus {
  private _onDidChange: Emitter<null> = new Emitter();

  public onDidChange: Event<null> = this._onDidChange.event;

  constructor() {
    super();
  }

  @OnEvent(FilesChangeEvent)
  onFilesChangeEvent() {
    this._onDidChange.fire(null);
  }
}

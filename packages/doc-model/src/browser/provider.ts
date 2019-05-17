import { Emitter as EventEmitter, URI, IDisposable } from '@ali/ide-core-common';
import {
  IDocumentModelProvider,
  IDocumentCreatedEvent,
  IDocumentChangedEvent,
  IDocumentRenamedEvent,
  IDocumentRemovedEvent,
  IDocumentModelMirror,
} from '../common/doc';

export class RemoteProvider implements IDocumentModelProvider {
  private _onChanged = new EventEmitter<IDocumentChangedEvent>();
  private _onCreated = new EventEmitter<IDocumentCreatedEvent>();
  private _onRenamed = new EventEmitter<IDocumentRenamedEvent>();
  private _onRemoved = new EventEmitter<IDocumentRemovedEvent>();

  public onChanged = this._onChanged.event;
  public onCreated = this._onCreated.event;
  public onRenamed = this._onRenamed.event;
  public onRemoved = this._onRemoved.event;

  async build() {
    // const res = await request('http://127.0.0.1:8000/1.json');
    const res = {
      lines: [
        'let b = 123',
        'b = 1000',
      ],
      eol: '\n',
      encoding: 'utf-8',
      uri: 'http://127.0.0.1:8000/1.json',
      language: 'javascript',
    } as IDocumentModelMirror
    return res;
  }

  watch() {
    return {
      dispose: () => {}
    }
  }
}

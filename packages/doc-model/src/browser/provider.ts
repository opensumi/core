import { Emitter as EventEmitter, URI, IDisposable, Event } from '@ali/ide-core-common';
import {
  IDocumentModeContentProvider,
  IDocumentCreatedEvent,
  IDocumentChangedEvent,
  IDocumentRenamedEvent,
  IDocumentRemovedEvent,
  IDocumentModelMirror,
} from '../common/doc';
import { INodeDocumentService } from '../common';

export class RemoteProvider implements IDocumentModeContentProvider {
  private _onChanged = new EventEmitter<IDocumentChangedEvent>();
  private _onCreated = new EventEmitter<IDocumentCreatedEvent>();
  private _onRenamed = new EventEmitter<IDocumentRenamedEvent>();
  private _onRemoved = new EventEmitter<IDocumentRemovedEvent>();

  public onChanged: Event<IDocumentChangedEvent> = this._onChanged.event;
  public onCreated: Event<IDocumentCreatedEvent> = this._onCreated.event;
  public onRenamed: Event<IDocumentRenamedEvent> = this._onRenamed.event;
  public onRemoved: Event<IDocumentRemovedEvent> = this._onRemoved.event;

  constructor(protected readonly docService: INodeDocumentService) {}

  async build(uri: URI) {
    // const res = await request('http://127.0.0.1:8000/1.json');
    if (uri.scheme === 'file') {
      const mirror = await this.docService.resolveContent(uri.toString());
      if (mirror) {
        return mirror;
      }
    }
    return null;
  }

  async persist(mirror: IDocumentModelMirror) {
    const uri = new URI(mirror.uri);
    if (uri.scheme === 'file') {
      const successd = await this.docService.saveContent(mirror);
      if (successd) {
        return mirror;
      }
    }
    return null;
  }

  watch() {
    return {
      dispose: () => {},
    };
  }
}

export class EmptyProvider extends RemoteProvider {
  async build(uri: URI) {
    // const res = await request('http://127.0.0.1:8000/1.json');
    if (uri.scheme === 'inmemory') {
      return {
        lines: [],
        eol: '\n',
        encoding: 'utf-8',
        uri: 'inmemory://tempfile',
        language: 'plaintext',
      };
    }
    return null;
  }

  async persist() {
    return null;
  }
}

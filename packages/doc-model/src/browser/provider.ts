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
import { Injectable, Inject, Autowired } from '@ali/common-di/dist';
import {
  documentService as servicePath,
} from '../common';

@Injectable()
export class RemoteProvider implements IDocumentModeContentProvider {
  private _onChanged = new EventEmitter<IDocumentChangedEvent>();
  private _onCreated = new EventEmitter<IDocumentCreatedEvent>();
  private _onRenamed = new EventEmitter<IDocumentRenamedEvent>();
  private _onRemoved = new EventEmitter<IDocumentRemovedEvent>();

  public onChanged: Event<IDocumentChangedEvent> = this._onChanged.event;
  public onCreated: Event<IDocumentCreatedEvent> = this._onCreated.event;
  public onRenamed: Event<IDocumentRenamedEvent> = this._onRenamed.event;
  public onRemoved: Event<IDocumentRemovedEvent> = this._onRemoved.event;

  constructor(@Inject(servicePath) protected readonly docService: INodeDocumentService) {}

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

  fireChangedEvent(e: IDocumentChangedEvent) {
    this._onChanged.fire(e);
  }

  async watch(uri: string | URI) {
    return this.docService.watch(uri.toString());
  }

  async unwatch(id: number) {
    return this.docService.unwatch(id);
  }
}

@Injectable()
export class EmptyProvider extends RemoteProvider {
  async build(uri: URI) {
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

@Injectable()
export class BrowserDocumentService {
  @Autowired()
  provider: RemoteProvider;

  async updateContent(mirror: IDocumentModelMirror) {
    this.provider.fireChangedEvent({
      uri: new URI(mirror.uri),
      mirror,
    });
  }
}

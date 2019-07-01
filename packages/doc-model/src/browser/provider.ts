import { Emitter as EventEmitter, URI, Event } from '@ali/ide-core-common';
import {
  IDocumentModeContentProvider,
  IDocumentCreatedEvent,
  IDocumentChangedEvent,
  IDocumentRenamedEvent,
  IDocumentRemovedEvent,
  IDocumentModelMirror,
  IDocumentModelStatMirror,
} from '../common/doc';
import { INodeDocumentService, Version, VersionType } from '../common';
import { Injectable, Inject, Autowired } from '@ali/common-di';
import {
  documentService as servicePath,
  IBrowserDocumentService,
} from '../common';

@Injectable()
export class RawFileProvider implements IDocumentModeContentProvider {
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
    if (uri.scheme === 'file') {
      const mirror = await this.docService.resolve(uri.toString());
      if (mirror) {
        return mirror;
      }
    }
    return null;
  }

  async persist(mirror: IDocumentModelStatMirror, stack: Array<monaco.editor.IModelContentChange>, override: boolean) {
    const uri = new URI(mirror.uri);
    if (uri.scheme === 'file') {
      const statMirror = await this.docService.persist(mirror, stack, override);
      if (statMirror) {
        return statMirror;
      }
    }
    return null;
  }

  fireChangedEvent(e: IDocumentChangedEvent) {
    this._onChanged.fire(e);
  }

  fireRemoveEvent(e: IDocumentRemovedEvent) {
    this._onRemoved.fire(e);
  }
}

@Injectable()
export class EmptyProvider extends RawFileProvider {
  async build(uri: URI) {
    if (uri.scheme === 'inmemory') {
      return {
        lines: [],
        eol: '\n',
        encoding: 'utf-8',
        uri: 'inmemory://tempfile',
        language: 'plaintext',
        base: Version.init(VersionType.browser),
      };
    }
    return null;
  }

  async persist() {
    return null;
  }
}

@Injectable()
export class BrowserDocumentService implements IBrowserDocumentService {
  @Autowired()
  provider: RawFileProvider;

  async updateContent(mirror: IDocumentModelMirror) {
    this.provider.fireChangedEvent({
      uri: new URI(mirror.uri),
      mirror,
    });
  }

  async updateFileRemoved(uri: string) {
    this.provider.fireRemoveEvent({ uri: new URI(uri) });
  }
}

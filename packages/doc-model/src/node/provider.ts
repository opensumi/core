// @ts-ignore
import * as detect from 'language-detect';
import { basename, extname } from 'path';
import { Emitter as EventEmitter, URI, Event } from '@ali/ide-core-common';
import { Injectable, Autowired } from '@ali/common-di';
import { FileService } from '@ali/ide-file-service/lib/node/file-service';
import {
  INodeDocumentService,
} from '../common';
import { RPCService } from '@ali/ide-connection';
import {
  IDocumentModeContentProvider,
  IDocumentCreatedEvent,
  IDocumentChangedEvent,
  IDocumentRenamedEvent,
  IDocumentRemovedEvent,
  IDocumentModelMirror,
} from '../common/doc';
import { FileChangeType } from '@ali/ide-file-service/lib/common/file-service-watcher-protocol';

function filename2Language(filename: string) {
  const ext = extname(filename);
  switch (ext) {
    case '.tsx':
    case '.ts':
      return 'typescript';
    default:
      return detect.filename(filename).toLowerCase(); // TODO use languages service
  }
}

@Injectable()
export class FileSystemProvider implements IDocumentModeContentProvider {
  static eol = '\n';

  @Autowired()
  private fileService: FileService;

  private _client: any;

  private _onChanged = new EventEmitter<IDocumentChangedEvent>();
  private _onCreated = new EventEmitter<IDocumentCreatedEvent>();
  private _onRenamed = new EventEmitter<IDocumentRenamedEvent>();
  private _onRemoved = new EventEmitter<IDocumentRemovedEvent>();

  public onChanged: Event<IDocumentChangedEvent> = this._onChanged.event;
  public onCreated: Event<IDocumentCreatedEvent> = this._onCreated.event;
  public onRenamed: Event<IDocumentRenamedEvent> = this._onRenamed.event;
  public onRemoved: Event<IDocumentRemovedEvent> = this._onRemoved.event;

  constructor() {
    this.fileService.onFilesChanged(async (event) => {
      const { changes } = event as any;
      for (const change of changes) {
        const { uri, type } = change as { uri: URI, type: FileChangeType };
        switch (type) {
          case FileChangeType.UPDATED:
            const mirror = await this._resolve(uri);
            this._onChanged.fire({ uri, mirror });
            if (this._client) {
              this._client.change();
            }
            break;
          case FileChangeType.DELETED:
            // TODO
            break;
          default:
            break;
        }
      }
    });
  }

  async _resolve(uri: string | URI) {
    const uriString = uri.toString();
    const res = await this.fileService.resolveContent(uriString);
    const encoding = await this.fileService.getEncoding(uriString);
    const lines = res.content.split(FileSystemProvider.eol);
    const eol = FileSystemProvider.eol;
    const language = filename2Language(basename(uri.toString()));

    const mirror: IDocumentModelMirror = {
      uri: uri.toString(),
      lines, eol, encoding, language,
    };

    return mirror;
  }

  setClient(client) {
    this._client = client;
  }

  async build(uri: URI) {
    const mirror = await this._resolve(uri);
    return mirror;
  }

  async persist(mirror: IDocumentModelMirror) {
    const uri = new URI(mirror.uri);
    if (uri.scheme === 'file') {
      const stat = await this.fileService.getFileStat(uri.toString());
      if (stat) {
        const res = await this.fileService.setContent(
          stat, mirror.lines.join(mirror.eol), {
          encoding: mirror.encoding,
        });
        return res ? mirror : null;
      }
    }
    return null;
  }

  async watch(uri: string | URI): Promise<number> {
    return this.fileService.watchFileChanges(uri.toString());
  }

  async unwatch(id: number) {
    return this.fileService.unwatchFileChanges(id);
  }
}

@Injectable()
export class NodeDocumentService extends RPCService implements INodeDocumentService {
  @Autowired()
  private provider: FileSystemProvider;

  constructor() {
    super();
    this.provider.setClient({
      change: () => {
        console.log(this.rpcClient);
      },
    });
  }

  async resolveContent(uri: URI) {
    const mirror = await this.provider.build(uri);
    if (mirror) {
      return mirror;
    }
    return null;
  }

  async saveContent(mirror: IDocumentModelMirror) {
    const doc = await this.provider.persist(mirror);
    if (doc) {
      return true;
    }
    return false;
  }

  async watch(uri: string): Promise<number> {
    return this.provider.watch(uri);
  }

  async unwatch(id: number) {
    return this.provider.unwatch(id);
  }
}

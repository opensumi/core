// @ts-ignore
import * as detect from 'language-detect';
import { basename, extname } from 'path';
import { Emitter as EventEmitter, URI, IDisposable, Event } from '@ali/ide-core-common';
import { Injectable, Autowired } from '@ali/common-di';
import { FileService } from '@ali/ide-file-service/lib/node/file-service';
import {
  IDocumentModeContentProvider,
  IDocumentCreatedEvent,
  IDocumentChangedEvent,
  IDocumentRenamedEvent,
  IDocumentRemovedEvent,
  IDocumentModelMirror,
} from '../common/doc';

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

  private _onChanged = new EventEmitter<IDocumentChangedEvent>();
  private _onCreated = new EventEmitter<IDocumentCreatedEvent>();
  private _onRenamed = new EventEmitter<IDocumentRenamedEvent>();
  private _onRemoved = new EventEmitter<IDocumentRemovedEvent>();

  public onChanged: Event<IDocumentChangedEvent> = this._onChanged.event;
  public onCreated: Event<IDocumentCreatedEvent> = this._onCreated.event;
  public onRenamed: Event<IDocumentRenamedEvent> = this._onRenamed.event;
  public onRemoved: Event<IDocumentRemovedEvent> = this._onRemoved.event;

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

  watch(uri: URI): IDisposable {
    // @ts-ignore
    if (this.fileService.watch) {
      // @ts-ignore
      return this.fileService.watch(uri, async (event) => {
        switch (event.type) {
          case 'change':
            const mirror = await this._resolve(event.uri);
            return this._onChanged.fire({ uri, mirror });
          case 'remove':
            return this._onRemoved.fire({ uri });
          case 'rename':
            const { from, to } = event;
            return this._onRenamed.fire({ from, to });
          default:
            break;
        }
      });
    }

    return {
      dispose: () => null,
    };
  }
}

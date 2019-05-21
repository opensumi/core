import { Emitter as EventEmitter, URI, IDisposable } from '@ali/ide-core-common';
import { Autowired } from '@ali/common-di';
import { NodeDocumentModel } from './doc-model';
import { FileService } from '@ali/ide-file-service/lib/node/file-service';
import {
  IDocumentModelProvider,
  IDocumentCreatedEvent,
  IDocumentChangedEvent,
  IDocumentRenamedEvent,
  IDocumentRemovedEvent,
  IDocumentModelMirror,
} from '../common/doc';

export class FileSystemProvider implements IDocumentModelProvider {
  static eol = '\n';

  public onChanged = this._onChanged.event;
  public onCreated = this._onCreated.event;
  public onRenamed = this._onRenamed.event;
  public onRemoved = this._onRemoved.event;

  @Autowired()
  private fileService: FileService;

  private _onChanged = new EventEmitter<IDocumentChangedEvent>();
  private _onCreated = new EventEmitter<IDocumentCreatedEvent>();
  private _onRenamed = new EventEmitter<IDocumentRenamedEvent>();
  private _onRemoved = new EventEmitter<IDocumentRemovedEvent>();

  async _resolve(uri: string | URI) {
    const uriString = uri.toString();
    const res = await this.fileService.resolveContent(uriString);
    const encoding = await this.fileService.getEncoding(uriString);
    const lines = res.content.split(FileSystemProvider.eol);
    const eol = FileSystemProvider.eol;

    const mirror: IDocumentModelMirror = {
      uri: uri.toString(),
      lines, eol, encoding, language: 'plaintext',
    };

    return mirror;
  }

  async build(uri: string | URI) {
    const mirror = await this._resolve(uri);
    const docModel = NodeDocumentModel.fromMirror(mirror);
    return docModel;
  }

  watch(_uri: string | URI): IDisposable {
    const uri = new URI(_uri.toString());

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

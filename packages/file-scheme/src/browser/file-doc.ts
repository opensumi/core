import { Injectable, Autowired } from '@ali/common-di';
import { IEditorDocumentModelContentProvider, IEditorDocumentModel } from '@ali/ide-editor/lib/browser';
import { FILE_SCHEME, IFileSchemeDocNodeService, FileSchemeDocNodeServicePath, FILE_SAVE_BY_CHANGE_THRESHOLD } from '../common';
import { URI, Emitter, Event, IEditorDocumentChange, IEditorDocumentModelSaveResult, IEditorDocumentEditChange } from '@ali/ide-core-browser';
import { IFileServiceClient, FileChangeType } from '@ali/ide-file-service';
import * as md5 from 'md5';

// TODO 这块其实应该放到file service当中
@Injectable()
export class FileSchemeDocumentProvider implements IEditorDocumentModelContentProvider {

  private _onDidChangeContent: Emitter<URI> = new Emitter();

  public onDidChangeContent: Event<URI> = this._onDidChangeContent.event;

  private _fileContentMd5OnBrowserFs: Set<string> = new Set();

  @Autowired(IFileServiceClient)
  fileServiceClient: IFileServiceClient;

  @Autowired(FileSchemeDocNodeServicePath)
  fileDocBackendService: IFileSchemeDocNodeService;

  constructor() {
    this.fileServiceClient.onFilesChanged((changes) => {
      changes.forEach((change) => {
        if (this._fileContentMd5OnBrowserFs.has(change.uri)) {
          if (change.type === FileChangeType.ADDED || change.type === FileChangeType.UPDATED) {
            this._onDidChangeContent.fire(new URI(change.uri));
          }
        }
      });
    });
  }

  handlesScheme(scheme: string) {
    return scheme === FILE_SCHEME;
  }

  async provideEditorDocumentModelContent(uri: URI, encoding) {
    const res = await this.fileServiceClient.resolveContent(uri.toString(), {
      encoding,
    });

    // 记录表示这个文档被引用了
    const content = res && res.content || '';
    this._fileContentMd5OnBrowserFs.add(uri.toString());

    return content;
  }

  isReadonly(uri: URI): boolean {
    return false;
  }

  async saveDocumentModel(uri: URI, content: string, baseContent: string, changes: IEditorDocumentChange[], encoding: string ): Promise<IEditorDocumentModelSaveResult>  {
    // TODO
    const baseMd5 = md5(baseContent);
    if (content.length > FILE_SAVE_BY_CHANGE_THRESHOLD) {
      return this.fileDocBackendService.$saveByChange(uri.toString(), {
        baseMd5,
        changes,
      }, encoding);
    } else {
      return await this.fileDocBackendService.$saveByContent(uri.toString(), {
        baseMd5,
        content,
      }, encoding);
    }
  }

  async provideEditorDocumentModelContentMd5(uri: URI, encoding?: string): Promise<string | undefined> {
    return this.fileDocBackendService.$getMd5(uri.toString(), encoding);
  }

  onDidDisposeModel(uri: URI) {
    this._fileContentMd5OnBrowserFs.delete(uri.toString());
  }

}

@Injectable()
export class DebugSchemeDocumentProvider extends FileSchemeDocumentProvider {
  handlesScheme(scheme: string) {
    return scheme === 'debug';
  }

  async provideEditorDocumentModelContent(uri: URI, encoding) {
    const res = await this.fileServiceClient.resolveContent(uri.toString(), {
      encoding,
    });

    // 记录表示这个文档被引用了
    const content = res && res.content || '';
    return content;
  }

  isReadonly(uri: URI): boolean {
    return true;
  }
}

import { Injectable, Autowired } from '@ide-framework/common-di';
import { IFileSchemeDocNodeService, FileSchemeDocNodeServicePath, IFileSchemeDocClient, IContentChange, ISavingContent } from '../common';
import { IEditorDocumentModelSaveResult } from '@ide-framework/ide-core-browser';

@Injectable()
export class FileSchemeDocClientService implements IFileSchemeDocClient {
  @Autowired(FileSchemeDocNodeServicePath)
  protected readonly fileDocBackendService: IFileSchemeDocNodeService;

  saveByChange(uri: string, change: IContentChange, encoding?: string | undefined, force?: boolean | undefined): Promise<IEditorDocumentModelSaveResult> {
    return this.fileDocBackendService.$saveByChange(uri, change, encoding, force);
  }

  saveByContent(uri: string, content: ISavingContent, encoding?: string | undefined, force?: boolean | undefined): Promise<IEditorDocumentModelSaveResult> {
    return this.fileDocBackendService.$saveByContent(uri, content, encoding, force);
  }

  getMd5(uri: string, encoding?: string | undefined): Promise<string | undefined> {
    return this.fileDocBackendService.$getMd5(uri, encoding);
  }
}

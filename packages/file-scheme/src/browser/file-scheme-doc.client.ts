import { Injectable, Autowired } from '@opensumi/di';
import { CancellationToken, IEditorDocumentModelSaveResult } from '@opensumi/ide-core-browser';

import { CancellationTokenSource } from '../../../utils/lib';
import {
  IFileSchemeDocNodeService,
  FileSchemeDocNodeServicePath,
  IFileSchemeDocClient,
  IContentChange,
  ISavingContent,
} from '../common';

@Injectable()
export class FileSchemeDocClientService implements IFileSchemeDocClient {
  @Autowired(FileSchemeDocNodeServicePath)
  protected readonly fileDocBackendService: IFileSchemeDocNodeService;

  saveByChange(
    uri: string,
    change: IContentChange,
    encoding?: string | undefined,
    force?: boolean | undefined,
    token?: CancellationToken,
  ): Promise<IEditorDocumentModelSaveResult> {
    return this.fileDocBackendService.$saveByChange(uri, change, encoding, force, token);
  }

  saveByContent(
    uri: string,
    content: ISavingContent,
    encoding?: string | undefined,
    force?: boolean | undefined,
    token?: CancellationToken,
  ): Promise<IEditorDocumentModelSaveResult> {
    return this.fileDocBackendService.$saveByContent(uri, content, encoding, force, token);
  }

  getMd5(uri: string, encoding?: string | undefined): Promise<string | undefined> {
    return this.fileDocBackendService.$getMd5(uri, encoding);
  }
}

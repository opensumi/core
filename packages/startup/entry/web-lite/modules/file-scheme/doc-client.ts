/* tslint:disable no-console */
import { Injectable } from '@ali/common-di';
import { IFileSchemeDocClient, IContentChange, ISavingContent } from '@ali/ide-file-scheme';
import { IEditorDocumentModelSaveResult } from '@ali/ide-core-browser';

/**
 * todo: 重写文档保存逻辑
 */
@Injectable()
export class FileSchemeDocClientService implements IFileSchemeDocClient {
  saveByChange(uri: string, change: IContentChange, encoding?: string | undefined, force?: boolean | undefined): Promise<IEditorDocumentModelSaveResult> {
    console.log(arguments, 'saveByChange');
    return Promise.resolve(null as any);
  }

  saveByContent(uri: string, content: ISavingContent, encoding?: string | undefined, force?: boolean | undefined): Promise<IEditorDocumentModelSaveResult> {
    console.log(arguments, 'saveByContent');
    return Promise.resolve(null as any);
  }

  getMd5(uri: string, encoding?: string | undefined): Promise<string | undefined> {
    console.log(arguments, 'getMd5');
    return Promise.resolve(undefined);
  }
}

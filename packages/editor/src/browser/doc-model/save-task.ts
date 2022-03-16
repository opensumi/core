import { URI, Deferred, IEditorDocumentChange, IEditorDocumentModelSaveResult } from '@opensumi/ide-core-browser';
import { EOL } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';

import { IEditorDocumentModelService } from './types';

export interface IEditorDocumentModelServiceImpl extends IEditorDocumentModelService {
  saveEditorDocumentModel(
    uri: URI,
    content: string,
    baseContent: string,
    changes: IEditorDocumentChange[],
    encoding?: string,
    ignoreDiff?: boolean,
    eol?: EOL,
  ): Promise<IEditorDocumentModelSaveResult>;
}

export class SaveTask {
  private deferred: Deferred<IEditorDocumentModelSaveResult> = new Deferred();

  public finished: Promise<IEditorDocumentModelSaveResult> = this.deferred.promise;

  public started = false;

  constructor(
    private uri: URI,
    public readonly versionId: number,
    public readonly alternativeVersionId: number,
    public content: string,
    private ignoreDiff: boolean,
  ) {}

  async run(
    service: IEditorDocumentModelServiceImpl,
    baseContent: string,
    changes: IEditorDocumentChange[],
    encoding?: string,
    eol?: EOL,
  ): Promise<IEditorDocumentModelSaveResult> {
    this.started = true;
    try {
      const res = await service.saveEditorDocumentModel(
        this.uri,
        this.content,
        baseContent,
        changes,
        encoding,
        this.ignoreDiff,
        eol,
      );
      this.deferred.resolve(res);
      return res;
    } catch (e) {
      const res = {
        errorMessage: e.message,
        state: 'error',
      } as any;
      this.deferred.resolve(res);
      return res;
    }
  }
}

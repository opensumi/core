import {
  CancellationToken,
  CancellationTokenSource,
  Deferred,
  Disposable,
  IEditorDocumentChange,
  IEditorDocumentModelSaveResult,
  SaveTaskErrorCause,
  SaveTaskResponseState,
  URI,
} from '@opensumi/ide-core-browser';
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
    token?: CancellationToken,
  ): Promise<IEditorDocumentModelSaveResult>;
}

export class SaveTask extends Disposable {
  private deferred: Deferred<IEditorDocumentModelSaveResult> = new Deferred();

  public finished: Promise<IEditorDocumentModelSaveResult> = this.deferred.promise;

  private cancelToken: CancellationTokenSource;

  public started = false;

  constructor(
    private uri: URI,
    public readonly versionId: number,
    public readonly alternativeVersionId: number,
    public content: string,
    private ignoreDiff: boolean,
  ) {
    super();
    this.disposables.push((this.cancelToken = new CancellationTokenSource()));
  }

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
        this.cancelToken.token,
      );
      this.deferred.resolve(res);
      return res;
    } catch (e) {
      const res: IEditorDocumentModelSaveResult = {
        errorMessage: e.message,
        state: SaveTaskResponseState.ERROR,
      };
      this.deferred.resolve(res);
      return res;
    }
  }

  cancel() {
    this.cancelToken.cancel();
    const res: IEditorDocumentModelSaveResult = {
      errorMessage: SaveTaskErrorCause.CANCEL,
      state: SaveTaskResponseState.ERROR,
    };
    this.deferred.resolve(res);
  }
}

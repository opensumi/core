import { URI, Deferred, IEditorDocumentChange, IEditorDocumentModelSaveResult } from '@ali/ide-core-browser';
import { IEditorDocumentModelService } from './types';

export interface IEditorDocumentModelServiceImpl extends IEditorDocumentModelService {

  saveEditorDocumentModel(uri: URI, content: string, baseContent: string, changes: IEditorDocumentChange[], encoding?: string): Promise<IEditorDocumentModelSaveResult>;

}

export class SaveTask {

  private deferred: Deferred<IEditorDocumentModelSaveResult> = new Deferred();

  public finished: Promise<IEditorDocumentModelSaveResult> = this.deferred.promise;

  public started: boolean = false;

  constructor(
    private uri: URI,
    public readonly versionId: number,
    public readonly alternativeVersionId: number,
    public content: string) {

  }

  async run(service: IEditorDocumentModelServiceImpl, baseContent: string, changes: IEditorDocumentChange[], encoding?: string): Promise<IEditorDocumentModelSaveResult> {
    this.started = true;
    try {
      const res = await service.saveEditorDocumentModel(this.uri, this.content, baseContent, changes, encoding);
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

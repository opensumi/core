import { LibroCellURIScheme } from '@difizen/libro-common';

import { Autowired, Injectable } from '@opensumi/di';
import { PreferenceService, getLanguageIdFromMonaco } from '@opensumi/ide-core-browser';
import {
  Emitter,
  Event,
  IApplicationService,
  IEditorDocumentModelSaveResult,
  MaybePromise,
  SaveTaskResponseState,
  URI,
} from '@opensumi/ide-core-common';
import { IEditorDocumentModelContentProvider } from '@opensumi/ide-editor/lib/browser/doc-model/types';

import { ILibroOpensumiService } from './libro.service';

@Injectable()
export class NotebookDocumentContentProvider implements IEditorDocumentModelContentProvider {
  @Autowired(IApplicationService)
  protected readonly applicationService: IApplicationService;

  @Autowired(PreferenceService)
  protected readonly preferenceService: PreferenceService;

  @Autowired(ILibroOpensumiService)
  protected readonly libroOpensumiService: ILibroOpensumiService;

  private _onDidChangeContent: Emitter<URI> = new Emitter();

  public onDidChangeContent: Event<URI> = this._onDidChangeContent.event;

  handlesScheme?(scheme: string): MaybePromise<boolean> {
    return scheme === LibroCellURIScheme;
  }

  async provideEditorDocumentModelContent(uri: URI, encoding?: string | undefined): Promise<string> {
    const cell = await this.libroOpensumiService.getCellViewByUri(uri);
    return cell?.model.value ?? '';
  }
  isReadonly(): MaybePromise<boolean> {
    return false;
  }
  saveDocumentModel?(): MaybePromise<IEditorDocumentModelSaveResult> {
    return {
      state: SaveTaskResponseState.SUCCESS,
    };
  }
  async preferLanguageForUri?(uri: URI): Promise<string | undefined> {
    const cell = await this.libroOpensumiService.getCellViewByUri(uri);
    if (!cell) {
      return;
    }
    return this.libroOpensumiService.getCellLanguage(cell);
  }
  provideEncoding?(uri: URI): MaybePromise<string> {
    const encoding = this.preferenceService.get<string>(
      'files.encoding',
      undefined,
      uri.toString(),
      getLanguageIdFromMonaco(uri)!,
    );
    return encoding || 'utf8';
  }
  isAlwaysDirty?(uri: URI): MaybePromise<boolean> {
    return false;
  }
  closeAutoSave?(uri: URI): MaybePromise<boolean> {
    return true;
  }
  disposeEvenDirty?(uri: URI): MaybePromise<boolean> {
    return false;
  }
}

import { LibroCellURIScheme } from '@difizen/libro-common';

import { Autowired, Injectable } from '@opensumi/di';
import { PreferenceService, getLanguageIdFromMonaco } from '@opensumi/ide-core-browser';
import {
  Emitter,
  Event,
  IApplicationService,
  IEditorDocumentChange,
  IEditorDocumentModelSaveResult,
  MaybePromise,
  SaveTaskResponseState,
  URI,
} from '@opensumi/ide-core-common';
import { IEditorDocumentModelContentProvider } from '@opensumi/ide-editor/lib/browser/doc-model/types';
import { EOL } from '@opensumi/ide-monaco';

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
  // handlesUri?(uri: URI): MaybePromise<number> {
  //   throw new Error("Method not implemented.");
  // }

  async provideEditorDocumentModelContent(uri: URI, encoding?: string | undefined): Promise<string> {
    const cell = await this.libroOpensumiService.getCellViewByUri(uri);
    return cell?.model.value ?? '';
  }
  isReadonly(uri: URI): MaybePromise<boolean> {
    return false;
  }
  saveDocumentModel?(
    uri: URI,
    content: string,
    baseContent: string,
    changes: IEditorDocumentChange[],
    encoding?: string | undefined,
    ignoreDiff?: boolean | undefined,
    eol?: EOL | undefined,
  ): MaybePromise<IEditorDocumentModelSaveResult> {
    return {
      state: SaveTaskResponseState.SUCCESS,
    };
  }
  async preferLanguageForUri?(uri: URI): Promise<string | undefined> {
    const cell = await this.libroOpensumiService.getCellViewByUri(uri);
    if (!cell) {
      return;
    }
    return this.libroOpensumiService.getCellLangauge(cell);
  }
  // async provideEOL?(uri: URI): Promise<EOL> {
  //   return '\n'
  // }
  provideEncoding?(uri: URI): MaybePromise<string> {
    const encoding = this.preferenceService.get<string>(
      'files.encoding',
      undefined,
      uri.toString(),
      getLanguageIdFromMonaco(uri)!,
    );
    return encoding || 'utf8';
  }

  // provideEditorDocumentModelContentMd5?(uri: URI, encoding?: string | undefined): MaybePromise<string | undefined> {
  //   throw new Error("Method not implemented.");
  // }
  // onDidDisposeModel?(uri: URI): void {
  //   throw new Error("Method not implemented.");
  // }
  isAlwaysDirty?(uri: URI): MaybePromise<boolean> {
    return false;
  }
  closeAutoSave?(uri: URI): MaybePromise<boolean> {
    return true;
  }
  // guessEncoding?(uri: URI): Promise<string | undefined> {
  //   throw new Error("Method not implemented.");
  // }
  disposeEvenDirty?(uri: URI): MaybePromise<boolean> {
    return false;
  }
}

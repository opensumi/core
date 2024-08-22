import { Injectable } from '@opensumi/di';
import { Emitter, Event, UriComponents, WithEventBus } from '@opensumi/ide-core-browser';

import type { INotebookModelAddedData, INotebookService, NotebookDataDto, NotebookDocumentChangeDto } from './types';

@Injectable()
export class NotebookService extends WithEventBus implements INotebookService {
  createNotebook: (data?: NotebookDataDto) => Promise<{ uri: UriComponents }>;
  openNotebook: (uriComponents: UriComponents) => Promise<{ uri: UriComponents }>;
  saveNotebook: (uriComponents: UriComponents) => Promise<boolean>;
  protected _onDidOpenNotebookDocument = new Emitter<INotebookModelAddedData>();
  onDidOpenNotebookDocument: Event<INotebookModelAddedData> = this._onDidOpenNotebookDocument.event;
  protected _onDidCloseNotebookDocument = new Emitter<UriComponents>();
  onDidCloseNotebookDocument: Event<UriComponents> = this._onDidCloseNotebookDocument.event;
  protected _onDidSaveNotebookDocument = new Emitter<UriComponents>();
  onDidSaveNotebookDocument: Event<UriComponents> = this._onDidSaveNotebookDocument.event;
  protected _onDidChangeNotebookDocument = new Emitter<NotebookDocumentChangeDto>();
  onDidChangeNotebookDocument: Event<NotebookDocumentChangeDto> = this._onDidChangeNotebookDocument.event;
}

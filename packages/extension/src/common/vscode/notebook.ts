import { Event, IDisposable, UriComponents } from '@opensumi/ide-core-common';
import {
  ICellRange,
  NotebookCellDto,
  NotebookCellsChangedEventDto,
  NotebookDataDto,
  NotebookDocumentMetadata,
} from '@opensumi/ide-editor';

import type vscode from 'vscode';

export interface IMainThreadNotebookDocumentsShape extends IDisposable {
  $tryCreateNotebook(options: { viewType: string; content?: NotebookDataDto }): Promise<UriComponents>;
  $tryOpenNotebook(uriComponents: UriComponents): Promise<UriComponents>;
  $trySaveNotebook(uri: UriComponents): Promise<boolean>;
}

export interface ExtensionNotebookDocumentManager extends IExtensionHostNotebookService {
  onDidOpenNotebookDocument: Event<vscode.NotebookDocument>;
  onDidCloseNotebookDocument: Event<vscode.NotebookDocument>;
  onDidChangeNotebookDocument: Event<vscode.NotebookDocumentChangeEvent>;
  onDidSaveNotebookDocument: Event<vscode.NotebookDocument>;
  notebookDocuments: readonly vscode.NotebookDocument[];
}

export interface INotebookModelAddedData {
  uri: UriComponents;
  versionId: number;
  cells: NotebookCellDto[];
  viewType: string;
  metadata?: NotebookDocumentMetadata;
}

export interface INotebookEditorAddData {
  id: string;
  documentUri: UriComponents;
  selections: ICellRange[];
  visibleRanges: ICellRange[];
  viewColumn?: number;
}

export interface INotebookDocumentsAndEditorsDelta {
  removedDocuments?: UriComponents[];
  addedDocuments?: INotebookModelAddedData[];
  removedEditors?: string[];
  addedEditors?: INotebookEditorAddData[];
  newActiveEditor?: string | null;
  visibleEditors?: string[];
}

export interface IExtensionHostNotebookService {
  $acceptDocumentAndEditorsDelta: (delta: INotebookDocumentsAndEditorsDelta) => void;
  $acceptModelChanged(
    uriComponents: UriComponents,
    event: NotebookCellsChangedEventDto,
    isDirty: boolean,
    newMetadata?: NotebookDocumentMetadata,
  ): void;
  $acceptDirtyStateChanged(uriComponents: UriComponents, isDirty: boolean): void;
  $acceptModelSaved(uriComponents: UriComponents): void;
}

export interface INotebookDocumentPropertiesChangeData {
  metadata?: NotebookDocumentMetadata;
}

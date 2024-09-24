import { Event, IRange, UriComponents } from '@opensumi/ide-core-common';

export enum NotebookCellsChangeType {
  ModelChange = 1,
  Move = 2,
  ChangeCellLanguage = 5,
  Initialize = 6,
  ChangeCellMetadata = 7,
  Output = 8,
  OutputItem = 9,
  ChangeCellContent = 10,
  ChangeDocumentMetadata = 11,
  ChangeCellInternalMetadata = 12,
  ChangeCellMime = 13,
  Unknown = 100,
}

export type NotebookCellTextModelSplice<T> = [start: number, deleteCount: number, newItems: T[]];

/**
 * [start, end]
 */
export interface ICellRange {
  /**
   * zero based index
   */
  start: number;

  /**
   * zero based index
   */
  end: number;
}

export enum CellKind {
  Markup = 1,
  Code = 2,
}

export interface NotebookCellMetadata {
  /**
   * custom metadata
   */
  [key: string]: unknown;
}

export interface ICellExecutionError {
  message: string;
  stack: string | undefined;
  uri: UriComponents;
  location: IRange | undefined;
}

export type NotebookDocumentMetadata = Record<string, unknown>;
export interface NotebookCellInternalMetadata {
  executionId?: string;
  executionOrder?: number;
  lastRunSuccess?: boolean;
  runStartTime?: number;
  runStartTimeAdjustment?: number;
  runEndTime?: number;
  renderDuration?: { [key: string]: number };
  error?: ICellExecutionError;
}

export interface NotebookOutputItemDto {
  readonly mime: string;
  readonly valueBytes: Buffer;
}

export interface NotebookOutputDto {
  items: NotebookOutputItemDto[];
  outputId: string;
  metadata?: Record<string, any>;
}

export interface NotebookCellDto {
  handle: number;
  uri: UriComponents;
  eol: string;
  source: string[];
  language: string;
  mime?: string;
  cellKind: CellKind;
  outputs: NotebookOutputDto[];
  metadata?: NotebookCellMetadata;
  internalMetadata?: NotebookCellInternalMetadata;
}

export interface NotebookCellDataDto {
  source: string;
  language: string;
  mime: string | undefined;
  cellKind: CellKind;
  outputs: NotebookOutputDto[];
  metadata?: NotebookCellMetadata;
  internalMetadata?: NotebookCellInternalMetadata;
}

export interface NotebookDataDto {
  readonly cells: NotebookCellDataDto[];
  readonly metadata: NotebookDocumentMetadata;
}

export interface NotebookCellsChangeLanguageEvent {
  readonly kind: NotebookCellsChangeType.ChangeCellLanguage;
  readonly index: number;
  readonly language: string;
}

export interface NotebookCellsChangeMimeEvent {
  readonly kind: NotebookCellsChangeType.ChangeCellMime;
  readonly index: number;
  readonly mime: string | undefined;
}

export interface NotebookCellsChangeMetadataEvent {
  readonly kind: NotebookCellsChangeType.ChangeCellMetadata;
  readonly index: number;
  readonly metadata: NotebookCellMetadata;
}

export interface NotebookCellsChangeInternalMetadataEvent {
  readonly kind: NotebookCellsChangeType.ChangeCellInternalMetadata;
  readonly index: number;
  readonly internalMetadata: NotebookCellInternalMetadata;
}

export interface NotebookCellContentChangeEvent {
  readonly kind: NotebookCellsChangeType.ChangeCellContent;
  readonly index: number;
}

export type NotebookRawContentEventDto =
  | {
      readonly kind: NotebookCellsChangeType.ModelChange;
      readonly changes: NotebookCellTextModelSplice<NotebookCellDto>[];
    }
  | {
      readonly kind: NotebookCellsChangeType.Move;
      readonly index: number;
      readonly length: number;
      readonly newIdx: number;
    }
  | {
      readonly kind: NotebookCellsChangeType.Output;
      readonly index: number;
      readonly outputs: NotebookOutputDto[];
    }
  | {
      readonly kind: NotebookCellsChangeType.OutputItem;
      readonly index: number;
      readonly outputId: string;
      readonly outputItems: NotebookOutputItemDto[];
      readonly append: boolean;
    }
  | NotebookCellsChangeLanguageEvent
  | NotebookCellsChangeMimeEvent
  | NotebookCellsChangeMetadataEvent
  | NotebookCellsChangeInternalMetadataEvent
  | NotebookCellContentChangeEvent;

export interface NotebookCellsChangedEventDto {
  readonly rawEvents: NotebookRawContentEventDto[];
  readonly versionId: number;
}

export interface INotebookModelAddedData {
  uri: UriComponents;
  versionId: number;
  cells: NotebookCellDto[];
  viewType: string;
  metadata?: NotebookDocumentMetadata;
}

export interface NotebookDocumentChangeDto {
  uri: UriComponents;
  event: NotebookCellsChangedEventDto;
  isDirty: boolean;
  metadata?: NotebookDocumentMetadata;
}

export const INotebookService = Symbol('INotebookService');

export interface INotebookService {
  createNotebook: (data?: NotebookDataDto) => Promise<{ uri: UriComponents }>;
  openNotebook: (uriComponents: UriComponents) => Promise<{ uri: UriComponents }>;
  saveNotebook: (uriComponents: UriComponents) => Promise<boolean>;

  onDidOpenNotebookDocument: Event<INotebookModelAddedData>;
  onDidCloseNotebookDocument: Event<UriComponents>;
  onDidSaveNotebookDocument: Event<UriComponents>;
  onDidChangeNotebookDocument: Event<NotebookDocumentChangeDto>;
}

/**
 * @deprecated use Schemes.notebookCell
 */
export const notebookCellScheme = 'vscode-notebook-cell';

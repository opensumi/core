import { Schemes } from '@opensumi/ide-core-common';
import { NotebookCellsChangeType } from '@opensumi/ide-editor/lib/common/notebook';

import { ExtensionDocumentDataManager, IExtensionDocumentModelOpenedEvent } from '../../../common/vscode';
import * as extHostTypeConverters from '../../../common/vscode/converter';
import { NotebookRange, Uri } from '../../../common/vscode/ext-types';
import {
  IMainThreadNotebookDocumentsShape,
  INotebookDocumentPropertiesChangeData,
  INotebookModelAddedData,
} from '../../../common/vscode/notebook';

import type {
  CellKind,
  NotebookCellDto,
  NotebookCellInternalMetadata,
  NotebookCellMetadata,
  NotebookCellTextModelSplice,
  NotebookCellsChangedEventDto,
  NotebookDocumentMetadata,
  NotebookOutputDto,
  NotebookOutputItemDto,
} from '@opensumi/ide-editor';
import type vscode from 'vscode';

class RawContentChangeEvent {
  constructor(
    readonly start: number,
    readonly deletedCount: number,
    readonly deletedItems: vscode.NotebookCell[],
    readonly items: ExtHostCell[],
  ) {}

  asApiEvent(): vscode.NotebookDocumentContentChange {
    return {
      range: new NotebookRange(this.start, this.start + this.deletedCount),
      addedCells: this.items.map((cell) => cell.apiCell),
      removedCells: this.deletedItems,
    };
  }
}

export class ExtHostCell {
  static asModelAddData(cell: NotebookCellDto): IExtensionDocumentModelOpenedEvent {
    return {
      eol: cell.eol,
      lines: cell.source,
      languageId: cell.language,
      uri: Uri.revive(cell.uri).toString(),
      dirty: false,
      versionId: 1,
    };
  }

  private _outputs: vscode.NotebookCellOutput[];
  private _metadata: Readonly<NotebookCellMetadata>;
  private _previousResult: Readonly<vscode.NotebookCellExecutionSummary | undefined>;

  private _internalMetadata: NotebookCellInternalMetadata;
  readonly handle: number;
  readonly uri: Uri;
  readonly cellKind: CellKind;

  private _apiCell: vscode.NotebookCell | undefined;
  private _mime: string | undefined;

  constructor(
    readonly notebook: ExtHostNotebookDocument,
    private readonly _extHostDocument: ExtensionDocumentDataManager,
    private readonly _cellData: NotebookCellDto,
  ) {
    this.handle = _cellData.handle;
    this.uri = Uri.revive(_cellData.uri);
    this.cellKind = _cellData.cellKind;
    // this._outputs = _cellData.outputs.map(extHostTypeConverters.NotebookCellOutput.to);
    this._internalMetadata = _cellData.internalMetadata ?? {};
    this._metadata = Object.freeze(_cellData.metadata ?? {});
    this._previousResult = Object.freeze(
      extHostTypeConverters.NotebookCellExecutionSummary.to(_cellData.internalMetadata ?? {}),
    );
  }

  get internalMetadata(): NotebookCellInternalMetadata {
    return this._internalMetadata;
  }

  get apiCell(): vscode.NotebookCell {
    if (!this._apiCell) {
      const that = this;
      const data = this._extHostDocument.getDocument(this.uri);
      if (!data) {
        throw new Error(`MISSING extHostDocument for notebook cell: ${this.uri}`);
      }
      const apiCell: vscode.NotebookCell = {
        get index() {
          return that.notebook.getCellIndex(that);
        },
        notebook: that.notebook.apiNotebook,
        kind: extHostTypeConverters.NotebookCellKind.to(this._cellData.cellKind),
        document: data,
        get mime() {
          return that._mime;
        },
        set mime(value: string | undefined) {
          that._mime = value;
        },
        get outputs() {
          return that._outputs.slice(0);
        },
        get metadata() {
          return that._metadata;
        },
        get executionSummary() {
          return that._previousResult;
        },
      };
      this._apiCell = Object.freeze(apiCell);
    }
    return this._apiCell;
  }

  setOutputs(newOutputs: NotebookOutputDto[]): void {
    // this._outputs = newOutputs.map(extHostTypeConverters.NotebookCellOutput.to);
  }

  setOutputItems(outputId: string, append: boolean, newOutputItems: NotebookOutputItemDto[]) {
    // to be implemented
  }

  setMetadata(newMetadata: NotebookCellMetadata): void {
    this._metadata = Object.freeze(newMetadata);
  }

  setInternalMetadata(newInternalMetadata: NotebookCellInternalMetadata): void {
    this._internalMetadata = newInternalMetadata;
    this._previousResult = Object.freeze(extHostTypeConverters.NotebookCellExecutionSummary.to(newInternalMetadata));
  }

  setMime(newMime: string | undefined) {}
}

export class ExtHostNotebookDocument {
  private static _handlePool: number = 0;
  readonly handle = ExtHostNotebookDocument._handlePool++;

  private readonly _cells: ExtHostCell[] = [];

  private readonly _notebookType: string;

  private _notebook: vscode.NotebookDocument | undefined;
  private _metadata: Record<string, any>;
  private _versionId: number = 0;
  private _isDirty: boolean = false;
  private _disposed: boolean = false;

  constructor(
    private readonly _proxy: IMainThreadNotebookDocumentsShape,
    private readonly _textDocuments: ExtensionDocumentDataManager,
    readonly uri: Uri,
    data: INotebookModelAddedData,
  ) {
    this._notebookType = data.viewType;
    this._metadata = Object.freeze(data.metadata ?? Object.create(null));
    this._spliceNotebookCells([[0, 0, data.cells]], true /* init -> no event*/, undefined);
    this._versionId = data.versionId;
  }

  dispose() {
    this._disposed = true;
  }

  get versionId(): number {
    return this._versionId;
  }

  get apiNotebook(): vscode.NotebookDocument {
    if (!this._notebook) {
      const that = this;
      const apiObject: vscode.NotebookDocument = {
        get uri() {
          return that.uri;
        },
        get version() {
          return that._versionId;
        },
        get notebookType() {
          return that._notebookType;
        },
        get isDirty() {
          return that._isDirty;
        },
        get isUntitled() {
          return that.uri.scheme === Schemes.untitled;
        },
        get isClosed() {
          return that._disposed;
        },
        get metadata() {
          return that._metadata;
        },
        get cellCount() {
          return that._cells.length;
        },
        cellAt(index) {
          index = that._validateIndex(index);
          return that._cells[index].apiCell;
        },
        getCells(range) {
          const cells = range ? that._getCells(range) : that._cells;
          return cells.map((cell) => cell.apiCell);
        },
        save() {
          return that._save();
        },
        [Symbol.for('debug.description')]() {
          return `NotebookDocument(${this.uri.toString()})`;
        },
      };
      this._notebook = Object.freeze(apiObject);
    }
    return this._notebook;
  }

  acceptDocumentPropertiesChanged(data: INotebookDocumentPropertiesChangeData) {
    if (data.metadata) {
      this._metadata = Object.freeze({ ...this._metadata, ...data.metadata });
    }
  }

  acceptDirty(isDirty: boolean): void {
    this._isDirty = isDirty;
  }

  acceptModelChanged(
    event: NotebookCellsChangedEventDto,
    isDirty: boolean,
    newMetadata: NotebookDocumentMetadata | undefined,
  ): vscode.NotebookDocumentChangeEvent {
    this._versionId = event.versionId;
    this._isDirty = isDirty;
    this.acceptDocumentPropertiesChanged({ metadata: newMetadata });

    const result = {
      notebook: this.apiNotebook,
      metadata: newMetadata,
      cellChanges: [] as vscode.NotebookDocumentCellChange[],
      contentChanges: [] as vscode.NotebookDocumentContentChange[],
    };

    type RelaxedCellChange = Partial<vscode.NotebookDocumentCellChange> & { cell: vscode.NotebookCell };
    const relaxedCellChanges: RelaxedCellChange[] = [];

    // -- apply change and populate content changes

    for (const rawEvent of event.rawEvents) {
      if (rawEvent.kind === NotebookCellsChangeType.ModelChange) {
        this._spliceNotebookCells(rawEvent.changes, false, result.contentChanges);
      } else if (rawEvent.kind === NotebookCellsChangeType.Move) {
        this._moveCells(rawEvent.index, rawEvent.length, rawEvent.newIdx, result.contentChanges);
      } else if (rawEvent.kind === NotebookCellsChangeType.Output) {
        this._setCellOutputs(rawEvent.index, rawEvent.outputs);
        relaxedCellChanges.push({
          cell: this._cells[rawEvent.index].apiCell,
          outputs: this._cells[rawEvent.index].apiCell.outputs,
        });
      } else if (rawEvent.kind === NotebookCellsChangeType.OutputItem) {
        this._setCellOutputItems(rawEvent.index, rawEvent.outputId, rawEvent.append, rawEvent.outputItems);
        relaxedCellChanges.push({
          cell: this._cells[rawEvent.index].apiCell,
          outputs: this._cells[rawEvent.index].apiCell.outputs,
        });
      } else if (rawEvent.kind === NotebookCellsChangeType.ChangeCellLanguage) {
        this._changeCellLanguage(rawEvent.index, rawEvent.language);
        relaxedCellChanges.push({
          cell: this._cells[rawEvent.index].apiCell,
          document: this._cells[rawEvent.index].apiCell.document,
        });
      } else if (rawEvent.kind === NotebookCellsChangeType.ChangeCellContent) {
        relaxedCellChanges.push({
          cell: this._cells[rawEvent.index].apiCell,
          document: this._cells[rawEvent.index].apiCell.document,
        });
      } else if (rawEvent.kind === NotebookCellsChangeType.ChangeCellMime) {
        this._changeCellMime(rawEvent.index, rawEvent.mime);
      } else if (rawEvent.kind === NotebookCellsChangeType.ChangeCellMetadata) {
        this._changeCellMetadata(rawEvent.index, rawEvent.metadata);
        relaxedCellChanges.push({
          cell: this._cells[rawEvent.index].apiCell,
          metadata: this._cells[rawEvent.index].apiCell.metadata,
        });
      } else if (rawEvent.kind === NotebookCellsChangeType.ChangeCellInternalMetadata) {
        this._changeCellInternalMetadata(rawEvent.index, rawEvent.internalMetadata);
        relaxedCellChanges.push({
          cell: this._cells[rawEvent.index].apiCell,
          executionSummary: this._cells[rawEvent.index].apiCell.executionSummary,
        });
      }
    }

    // -- compact cellChanges

    const map = new Map<vscode.NotebookCell, number>();
    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let i = 0; i < relaxedCellChanges.length; i++) {
      const relaxedCellChange = relaxedCellChanges[i];
      const existing = map.get(relaxedCellChange.cell);
      if (existing === undefined) {
        const newLen = result.cellChanges.push({
          document: undefined,
          executionSummary: undefined,
          metadata: undefined,
          outputs: undefined,
          ...relaxedCellChange,
        });
        map.set(relaxedCellChange.cell, newLen - 1);
      } else {
        result.cellChanges[existing] = {
          ...result.cellChanges[existing],
          ...relaxedCellChange,
        };
      }
    }

    // Freeze event properties so handlers cannot accidentally modify them
    Object.freeze(result);
    Object.freeze(result.cellChanges);
    Object.freeze(result.contentChanges);

    return result;
  }

  private _validateIndex(index: number): number {
    index = index | 0;
    if (index < 0) {
      return 0;
    } else if (index >= this._cells.length) {
      return this._cells.length - 1;
    } else {
      return index;
    }
  }

  private _validateRange(range: vscode.NotebookRange): vscode.NotebookRange {
    let start = range.start | 0;
    let end = range.end | 0;
    if (start < 0) {
      start = 0;
    }
    if (end > this._cells.length) {
      end = this._cells.length;
    }
    return range.with({ start, end });
  }

  private _getCells(range: vscode.NotebookRange): ExtHostCell[] {
    range = this._validateRange(range);
    const result: ExtHostCell[] = [];
    for (let i = range.start; i < range.end; i++) {
      result.push(this._cells[i]);
    }
    return result;
  }

  private async _save(): Promise<boolean> {
    if (this._disposed) {
      return Promise.reject(new Error('Notebook has been closed'));
    }
    return this._proxy.$trySaveNotebook(this.uri);
  }

  private _spliceNotebookCells(
    splices: NotebookCellTextModelSplice<NotebookCellDto>[],
    initialization: boolean,
    bucket: vscode.NotebookDocumentContentChange[] | undefined,
  ): void {
    if (this._disposed) {
      return;
    }

    const contentChangeEvents: RawContentChangeEvent[] = [];
    const addedCellDocuments: IExtensionDocumentModelOpenedEvent[] = [];
    const removedCellDocuments: Uri[] = [];

    splices.reverse().forEach((splice) => {
      const cellDtos = splice[2];
      const newCells = cellDtos.map((cell) => {
        const extCell = new ExtHostCell(this, this._textDocuments, cell);
        if (!initialization) {
          addedCellDocuments.push(ExtHostCell.asModelAddData(cell));
        }
        return extCell;
      });

      const changeEvent = new RawContentChangeEvent(splice[0], splice[1], [], newCells);
      const deletedItems = this._cells.splice(splice[0], splice[1], ...newCells);
      for (const cell of deletedItems) {
        removedCellDocuments.push(cell.uri);
        changeEvent.deletedItems.push(cell.apiCell);
      }
      contentChangeEvents.push(changeEvent);
    });

    addedCellDocuments.forEach((doc) => {
      this._textDocuments.$fireModelOpenedEvent(doc);
    });
    removedCellDocuments.forEach((doc) => {
      this._textDocuments.$fireModelRemovedEvent({ uri: doc.toString() });
    });

    if (bucket) {
      for (const changeEvent of contentChangeEvents) {
        bucket.push(changeEvent.asApiEvent());
      }
    }
  }

  private _moveCells(
    index: number,
    length: number,
    newIdx: number,
    bucket: vscode.NotebookDocumentContentChange[],
  ): void {
    const cells = this._cells.splice(index, length);
    this._cells.splice(newIdx, 0, ...cells);
    const changes = [
      new RawContentChangeEvent(
        index,
        length,
        cells.map((c) => c.apiCell),
        [],
      ),
      new RawContentChangeEvent(newIdx, 0, [], cells),
    ];
    for (const change of changes) {
      bucket.push(change.asApiEvent());
    }
  }

  private _setCellOutputs(index: number, outputs: NotebookOutputDto[]): void {
    const cell = this._cells[index];
    cell.setOutputs(outputs);
  }

  private _setCellOutputItems(
    index: number,
    outputId: string,
    append: boolean,
    outputItems: NotebookOutputItemDto[],
  ): void {
    const cell = this._cells[index];
    cell.setOutputItems(outputId, append, outputItems);
  }

  private _changeCellLanguage(index: number, newLanguageId: string): void {
    const cell = this._cells[index];
    if (cell.apiCell.document.languageId !== newLanguageId) {
      this._textDocuments.$fireModelOptionsChangedEvent({ languageId: newLanguageId, uri: cell.uri.toString() });
    }
  }

  private _changeCellMime(index: number, newMime: string | undefined): void {
    const cell = this._cells[index];
    cell.apiCell.mime = newMime;
  }

  private _changeCellMetadata(index: number, newMetadata: NotebookCellMetadata): void {
    const cell = this._cells[index];
    cell.setMetadata(newMetadata);
  }

  private _changeCellInternalMetadata(index: number, newInternalMetadata: NotebookCellInternalMetadata): void {
    const cell = this._cells[index];
    cell.setInternalMetadata(newInternalMetadata);
  }

  getCellFromApiCell(apiCell: vscode.NotebookCell): ExtHostCell | undefined {
    return this._cells.find((cell) => cell.apiCell === apiCell);
  }

  getCellFromIndex(index: number): ExtHostCell | undefined {
    return this._cells[index];
  }

  getCell(cellHandle: number): ExtHostCell | undefined {
    return this._cells.find((cell) => cell.handle === cellHandle);
  }

  getCellIndex(cell: ExtHostCell): number {
    return this._cells.indexOf(cell);
  }
}

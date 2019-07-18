import { IExtensionHostEditorService, ExtensionDocumentDataManager } from '../../common';
import { IRPCProtocol } from '@ali/ide-connection';
import * as vscode from 'vscode';
import { Uri } from '../../common/ext-types';
import { ISelection, Emitter, Event, IRange } from '@ali/ide-core-common';
import { TypeConverts, toPosition } from '../../common/coverter';
import { IEditorStatusChangeDTO, IEditorChangeDTO, TextEditorSelectionChangeKind, IEditorCreatedDTO, IResolvedTextEditorConfiguration } from './../../common/editor';

export class ExtensionHostEditorService implements IExtensionHostEditorService {

  private _editors: Map<string, TextEditorData> = new Map();

  private _activeEditorId: string | undefined;

  public readonly _onDidChangeActiveTextEditor: Emitter<vscode.TextEditor | undefined> = new Emitter();
  public readonly _onDidChangeVisibleTextEditors: Emitter<vscode.TextEditor[]> = new Emitter();
  public readonly _onDidChangeTextEditorSelection: Emitter<vscode.TextEditorSelectionChangeEvent> = new Emitter();
  public readonly _onDidChangeTextEditorVisibleRanges: Emitter<vscode.TextEditorVisibleRangesChangeEvent> = new Emitter();
  public readonly _onDidChangeTextEditorOptions: Emitter<vscode.TextEditorOptionsChangeEvent> = new Emitter();
  public readonly _onDidChangeTextEditorViewColumn: Emitter<vscode.TextEditorViewColumnChangeEvent> = new Emitter();

  public readonly onDidChangeActiveTextEditor: Event<vscode.TextEditor | undefined> = this._onDidChangeActiveTextEditor.event;
  public readonly onDidChangeVisibleTextEditors: Event<vscode.TextEditor[]> = this._onDidChangeVisibleTextEditors.event;
  public readonly onDidChangeTextEditorSelection: Event<vscode.TextEditorSelectionChangeEvent> = this._onDidChangeTextEditorSelection.event;
  public readonly onDidChangeTextEditorVisibleRanges: Event<vscode.TextEditorVisibleRangesChangeEvent> = this._onDidChangeTextEditorVisibleRanges.event;
  public readonly onDidChangeTextEditorOptions: Event<vscode.TextEditorOptionsChangeEvent> = this._onDidChangeTextEditorOptions.event;
  public readonly onDidChangeTextEditorViewColumn: Event<vscode.TextEditorViewColumnChangeEvent> = this._onDidChangeTextEditorViewColumn.event;

  constructor(rpcProtocol: IRPCProtocol, public readonly documents: ExtensionDocumentDataManager) {

  }

  $acceptChange(change: IEditorChangeDTO) {
    console.log(change);
    if (change.created) {
      change.created.forEach((created) => {
        this._editors.set(created.id, new TextEditorData(created, this, this.documents));
      });
    }

    if (change.removed) {
      change.removed.forEach((id) => {
        this._editors.delete(id);
      });
    }

    if (change.actived) {
      if (this._editors.has(change.actived)) {
        this._activeEditorId = change.actived;
        this._onDidChangeActiveTextEditor.fire(this.activeEditor ? this.activeEditor!.textEditor : undefined);
      }
    }

    if (change.created || change.removed) {
      this._onDidChangeVisibleTextEditors.fire(this.visibleEditors);
    }

  }

  $acceptPropertiesChange(change: IEditorStatusChangeDTO) {
    if (this._editors.get(change.id)) {
      this._editors.get(change.id)!.acceptStatusChange(change);
    }
  }

  getEditor(id: string): TextEditorData | undefined {
    return this._editors.get(id);
  }

  get activeEditor(): TextEditorData | undefined {
    if (!this._activeEditorId) {
      return undefined;
    } else {
      return this._editors.get(this._activeEditorId);
    }
  }

  get visibleEditors(): vscode.TextEditor[] {
    return Array.from(this._editors.values()).map((e) => e.textEditor);
  }

}

export class TextEditorData {

  public readonly id: string;

  constructor(created: IEditorCreatedDTO , public readonly editorService: ExtensionHostEditorService , public readonly documents: ExtensionDocumentDataManager) {
    this.uri = Uri.parse(created.uri);
    this.id = created.id;
    this._acceptSelections(created.selections);
    this._acceptOptions(created.options);
    this._acceptVisibleRanges(created.visibleRanges);
  }

  readonly uri: Uri;

  selections: vscode.Selection[];

  visibleRanges: vscode.Range[];

  options: vscode.TextEditorOptions;

  viewColumn?: vscode.ViewColumn | undefined;

  private _textEditor: vscode.TextEditor;

  edit(callback: (editBuilder: vscode.TextEditorEdit) => void, options?: { undoStopBefore: boolean; undoStopAfter: boolean; } | undefined): Thenable<boolean> {
    throw new Error('Method not implemented.');
  }
  insertSnippet(snippet: vscode.SnippetString, location?: vscode.Range | vscode.Position | readonly vscode.Position[] | readonly vscode.Range[] | undefined, options?: { undoStopBefore: boolean; undoStopAfter: boolean; } | undefined): Thenable<boolean> {
    throw new Error('Method not implemented.');
  }
  setDecorations(decorationType: vscode.TextEditorDecorationType, rangesOrOptions: vscode.Range[] | vscode.DecorationOptions[]): void {
    throw new Error('Method not implemented.');
  }
  revealRange(range: vscode.Range, revealType?: vscode.TextEditorRevealType | undefined): void {
    throw new Error('Method not implemented.');
  }
  show(column?: vscode.ViewColumn | undefined): void {
    throw new Error('Method not implemented.');
  }
  hide(): void {
    throw new Error('Method not implemented.');
  }

  _acceptSelections(selections: ISelection[] = []) {
    this.selections = selections.map((selection) => TypeConverts.Selection.to(selection));
  }

  _acceptOptions(options: IResolvedTextEditorConfiguration) {
    this.options = {
      tabSize: options.tabSize,
      insertSpaces: options.insertSpaces,
      cursorStyle: options.cursorStyle,
      lineNumbers: TypeConverts.TextEditorLineNumbersStyle.to(options.lineNumbers),
    };
  }

  _acceptVisibleRanges(value: IRange[]): void {
    this.visibleRanges = value.map((v) => TypeConverts.Range.to(v));
  }

  acceptStatusChange(change: IEditorStatusChangeDTO) {
    if (change.selections) {
      this._acceptSelections(change.selections.selections);
      this.editorService._onDidChangeTextEditorSelection.fire({
        kind: TextEditorSelectionChangeKind.fromValue(change.selections.source),
        selections: this.selections,
        textEditor: this.textEditor,
      });
    }
    if (change.options) {
      this._acceptOptions(change.options);
      this.editorService._onDidChangeTextEditorOptions.fire({
        textEditor: this.textEditor,
        options: this.options,
      });
    }
    if (change.visibleRanges) {
      this._acceptVisibleRanges(change.visibleRanges);
      this.editorService._onDidChangeTextEditorVisibleRanges.fire({
        textEditor: this.textEditor,
        visibleRanges: this.visibleRanges,
      });
    }

  }

  get textEditor(): vscode.TextEditor {
    if (!this._textEditor) {
      const data = this;
      this._textEditor = {
        get document() {
          return data.documents.getDocument(data.uri)!;
        },
        get selections() {
          return data.selections;
        },
        get selection() {
          return data.selections && data.selections[0];
        },
        get options() {
          return data.options;
        },
        get visibleRanges() {
          return data.visibleRanges;
        },
        edit: data.edit.bind(data),
        insertSnippet: data.insertSnippet.bind(data),
        setDecorations: data.setDecorations.bind(data),
        revealRange: data.revealRange.bind(data),
        show: data.show.bind(data),
        hide: data.hide.bind(data),
      };
    }
    return this._textEditor;
  }

}

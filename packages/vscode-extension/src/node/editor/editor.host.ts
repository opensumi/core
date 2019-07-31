import { IExtensionHostEditorService, ExtensionDocumentDataManager, MainThreadAPIIdentifier } from '../../common';
import { IRPCProtocol } from '@ali/ide-connection';
import * as vscode from 'vscode';
import { Uri, Position, Range, Selection, EndOfLine} from '../../common/ext-types';
import { ISelection, Emitter, Event, IRange, getLogger } from '@ali/ide-core-common';
import { TypeConverts, toPosition, fromPosition, fromRange, fromSelection } from '../../common/converter';
import { IEditorStatusChangeDTO, IEditorChangeDTO, TextEditorSelectionChangeKind, IEditorCreatedDTO, IResolvedTextEditorConfiguration, IMainThreadEditorsService } from './../../common/editor';
import { TextEditorEdit } from './edit.builder';
import { ISingleEditOperation, IDecorationApplyOptions, IResourceOpenOptions } from '@ali/ide-editor';

export class ExtensionHostEditorService implements IExtensionHostEditorService {

  private _editors: Map<string, TextEditorData> = new Map();

  private _activeEditorId: string | undefined;

  private decorationIdCount = 0;

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

  public readonly _proxy: IMainThreadEditorsService;

  private _onEditorCreated: Emitter<string> = new Emitter();
  private onEditorCreated: Event<string> = this._onEditorCreated.event;

  constructor(rpcProtocol: IRPCProtocol, public readonly documents: ExtensionDocumentDataManager) {
    this._proxy = rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadEditors);
    // this._proxy.$getInitialState().then((change) => {
    //   console.log('$getInitialState', change);
    //   this.$acceptChange(change);
    // });
  }

  $acceptChange(change: IEditorChangeDTO) {
    if (change.created) {
      change.created.forEach((created) => {
        this._editors.set(created.id, new TextEditorData(created, this, this.documents));
        this._onEditorCreated.fire(created.id);
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

  async openResource(uri: Uri, options: IResourceOpenOptions): Promise<vscode.TextEditor> {
    const id = await this._proxy.$openResource(uri.toString(), options);
    if (this.getEditor(id)) {
      return this.getEditor(id)!.textEditor;
    } else {
      return new Promise((resolve, reject) => {
        let resolved = false;
        const disposer = this.onEditorCreated((created) => {
          if (created === id && this.getEditor(id)) {
            resolve(this.getEditor(id)!.textEditor);
            resolved = true;
            disposer.dispose();
          }
        });
        setTimeout(() => {
          if (!resolved) {
            reject(new Error(`Timout opening textDocument uri ${uri.toString()}`));
          }
        }, 5000);
      });
    }
  }

  async showTextDocument(documentOrUri: vscode.TextDocument | Uri, columnOrOptions?: vscode.ViewColumn | vscode.TextDocumentShowOptions, preserveFocus?: boolean): Promise<vscode.TextEditor> {
    let uri: Uri;
    if (Uri.isUri(documentOrUri)) {
      uri = documentOrUri;
    } else {
      uri = documentOrUri.uri;
    }
    let options: IResourceOpenOptions;
    if (typeof columnOrOptions === 'number') {
      options = {
        groupIndex: columnOrOptions,
        preserveFocus,
      };
    } else if (typeof columnOrOptions === 'object') {
      options = {
        groupIndex: columnOrOptions.viewColumn,
        preserveFocus: columnOrOptions.preserveFocus,
        range: typeof columnOrOptions.selection === 'object' ? TypeConverts.Range.from(columnOrOptions.selection) : undefined,
        // TODO pinned: typeof columnOrOptions.preview === 'boolean' ? !columnOrOptions.preview : undefined
      };
    } else {
      options = {
        preserveFocus: false,
      };
    }
    return this.openResource(uri, options);
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

  closeEditor(editor: TextEditorData): void {
    if (editor.id !== this._activeEditorId) {
      return ; // TODO depecrated warning
    }
    this._proxy.$closeEditor(editor.id);
  }

  getNextId() {
    this.decorationIdCount++;
    return 'textEditor-decoration-' + this.decorationIdCount;
  }

  createTextEditorDecorationType(options: vscode.DecorationRenderOptions): vscode.TextEditorDecorationType {
    const resolved = TypeConverts.DecorationRenderOptions.from(options);
    const key = this.getNextId();
    this._proxy.$createTextEditorDecorationType(key, resolved);
    return {
      key,
      dispose: () => {
        this._proxy.$deleteTextEditorDecorationType(key);
      },
    };
  }

}

export class TextEditorData {

  public readonly id: string;

  public readonly group: string;

  constructor(created: IEditorCreatedDTO , public readonly editorService: ExtensionHostEditorService , public readonly documents: ExtensionDocumentDataManager) {
    this.uri = Uri.parse(created.uri);
    this.id = created.id;
    this._acceptSelections(created.selections);
    this._acceptOptions(created.options);
    this._acceptVisibleRanges(created.visibleRanges);
    this._acceptViewColumn(created.viewColumn);
  }

  readonly uri: Uri;

  selections: vscode.Selection[];

  visibleRanges: vscode.Range[];

  options: vscode.TextEditorOptions;

  viewColumn?: vscode.ViewColumn | undefined;

  private _textEditor: vscode.TextEditor;

  edit(callback: (editBuilder: vscode.TextEditorEdit) => void, options: { undoStopBefore: boolean; undoStopAfter: boolean; } = { undoStopBefore: true, undoStopAfter: true }): Promise<boolean> {
    const document = this.documents.getDocument(this.uri);
    if (!document) {
      throw new Error('document not found when editing');
    }
    const edit = new TextEditorEdit(document, options);
    callback(edit);
    return this._applyEdit(edit);
  }

  private _applyEdit(editBuilder: TextEditorEdit): Promise<boolean> {
    const editData = editBuilder.finalize();

    // return when there is nothing to do
    if (editData.edits.length === 0 && !editData.setEndOfLine) {
      return Promise.resolve(true);
    }

    // check that the edits are not overlapping (i.e. illegal)
    const editRanges = editData.edits.map((edit) => edit.range);

    // sort ascending (by end and then by start)
    editRanges.sort((a, b) => {
      if (a.end.line === b.end.line) {
        if (a.end.character === b.end.character) {
          if (a.start.line === b.start.line) {
            return a.start.character - b.start.character;
          }
          return a.start.line - b.start.line;
        }
        return a.end.character - b.end.character;
      }
      return a.end.line - b.end.line;
    });

    // check that no edits are overlapping
    for (let i = 0, count = editRanges.length - 1; i < count; i++) {
      const rangeEnd = editRanges[i].end;
      const nextRangeStart = editRanges[i + 1].start;

      if (nextRangeStart.isBefore(rangeEnd)) {
        // overlapping ranges
        return Promise.reject(
          new Error('Overlapping ranges are not allowed!'),
        );
      }
    }

    // prepare data for serialization
    const edits = editData.edits.map((edit): ISingleEditOperation => {
      return {
        range: TypeConverts.Range.from(edit.range),
        text: edit.text,
        forceMoveMarkers: edit.forceMoveMarkers,
      };
    });

    return this.editorService._proxy.$applyEdits(this.id, editData.documentVersionId, edits, {
      setEndOfLine: typeof editData.setEndOfLine === 'number' ? TypeConverts.EndOfLine.from(editData.setEndOfLine) : undefined,
      undoStopBefore: editData.undoStopBefore,
      undoStopAfter: editData.undoStopAfter,
    });
  }

  async insertSnippet(snippet: vscode.SnippetString, location?: vscode.Range | vscode.Position | readonly vscode.Position[] | readonly vscode.Range[] | undefined, options?: { undoStopBefore: boolean; undoStopAfter: boolean; } | undefined): Promise<boolean> {
    try {
      let _location: IRange[] = [];
      if (location) {
        if (location instanceof Array) {
          _location = location.map((l) => toIRange(l));
        } else {
          const l = location as (vscode.Range | vscode.Position);
          _location = [toIRange(l)];
        }
      }
      this.editorService._proxy.$insertSnippet(this.id, snippet.value, _location, options);
      return true;
    } catch (e) {
      getLogger().error(e);
      return false;
    }
  }
  setDecorations(decorationType: vscode.TextEditorDecorationType, rangesOrOptions: vscode.Range[] | vscode.DecorationOptions[]): void {
    let resolved: IDecorationApplyOptions[] = [];
    if (rangesOrOptions.length !== 0) {
      if (Range.isRange(rangesOrOptions[0])) {
        resolved = (rangesOrOptions as vscode.Range[]).map((r) => {
          return {
            range: fromRange(r),
          };
        });
      } else if (Range.isRange((rangesOrOptions[0]! as any).range)) {
        resolved = (rangesOrOptions as vscode.DecorationOptions[]).map((r) => {
          return {
            range: fromRange(r.range),
            renderOptions: r.renderOptions ? TypeConverts.DecorationRenderOptions.from(r.renderOptions) : undefined,
            hoverMessage: r.hoverMessage as any,
          };
        });
      }
    }
    this.editorService._proxy.$applyDecoration(this.id, decorationType.key, resolved);
  }
  revealRange(range: vscode.Range, revealType?: vscode.TextEditorRevealType | undefined): void {
    this.editorService._proxy.$revealRange(this.id, TypeConverts.Range.from(range), revealType);
  }
  show(column?: vscode.ViewColumn | undefined): void {
    getLogger().warn('TextEditor.show is Deprecated');
  }
  hide(): void {
    this.editorService.closeEditor(this);
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
    this.visibleRanges = value.map((v) => TypeConverts.Range.to(v)).filter((v) => !!v) as vscode.Range[];
  }

  _acceptViewColumn(value: number): void {
    this.viewColumn = value;
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
    if (change.viewColumn) {
      this._acceptViewColumn(change.viewColumn);
      this.editorService._onDidChangeTextEditorViewColumn.fire({
        textEditor: this.textEditor,
        viewColumn: this.viewColumn!,
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
        set selections(val) {
          // if (!Array.isArray(val) || val.some((s) => !(s instanceof vscode.Selection))) {
          //     throw Error('selections type is error');
          // }

          data.selections = val;
          data.editorService._proxy.$setSelections(data.id, data.selections.map((selection) => fromSelection(selection)));
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
        get viewColumn() {
          return data.viewColumn;
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

export function toIRange(range: vscode.Range | vscode.Selection | vscode.Position): IRange {
  if (Range.isRange(range)) {
    // vscode.Range
    return fromRange(range);
  } else if (Selection.isSelection(range)) {
    // vscode.Selection
    const r = range as vscode.Selection;
    if (r.active.isBeforeOrEqual(r.anchor)) {
      return {
        startLineNumber: r.active.line + 1,
        startColumn: r.active.character + 1,
        endLineNumber: r.anchor.line + 1,
        endColumn: r.anchor.character + 1,
      };
    } else {
      return {
        startLineNumber: r.anchor.line + 1,
        startColumn: r.anchor.character + 1,
        endLineNumber: r.active.line + 1,
        endColumn: r.active.character + 1,
      };
    }
  } else if (Position.isPosition(range)) {
    const r = range as vscode.Position;
    return {
      startLineNumber: r.line + 1,
      startColumn: r.character + 1,
      endLineNumber: r.line + 1,
      endColumn: r.character + 1,
    };
  }
  return {
    startLineNumber: 1,
    startColumn: 1,
    endLineNumber: 1,
    endColumn: 1,
  };
}

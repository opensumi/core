import debounce = require('lodash.debounce');
import type vscode from 'vscode';

import { IRPCProtocol } from '@opensumi/ide-connection';
import { ISelection, Emitter, Event, IRange, getDebugLogger, Disposable } from '@opensumi/ide-core-common';
import { ISingleEditOperation, IDecorationApplyOptions, IResourceOpenOptions } from '@opensumi/ide-editor';

import {
  IExtensionHostEditorService,
  ExtensionDocumentDataManager,
  MainThreadAPIIdentifier,
} from '../../../../common/vscode';
import * as TypeConverts from '../../../../common/vscode/converter';
import {
  IEditorStatusChangeDTO,
  IEditorChangeDTO,
  TextEditorSelectionChangeKind,
  IEditorCreatedDTO,
  IResolvedTextEditorConfiguration,
  IMainThreadEditorsService,
  ITextEditorUpdateConfiguration,
  TextEditorCursorStyle,
} from '../../../../common/vscode/editor';
import { Uri, Position, Range, Selection, TextEditorLineNumbersStyle } from '../../../../common/vscode/ext-types';

import { TextEditorEdit } from './edit.builder';


export class ExtensionHostEditorService implements IExtensionHostEditorService {
  private _editors: Map<string, TextEditorData> = new Map();

  private _activeEditorId: string | undefined;

  private decorationIdCount = 0;

  public readonly _onDidChangeActiveTextEditor: Emitter<vscode.TextEditor | undefined> = new Emitter();
  public readonly _onDidChangeVisibleTextEditors: Emitter<vscode.TextEditor[]> = new Emitter();
  public readonly _onDidChangeTextEditorSelection: Emitter<vscode.TextEditorSelectionChangeEvent> = new Emitter();
  public readonly _onDidChangeTextEditorVisibleRanges: Emitter<vscode.TextEditorVisibleRangesChangeEvent> =
    new Emitter();
  public readonly _onDidChangeTextEditorOptions: Emitter<vscode.TextEditorOptionsChangeEvent> = new Emitter();
  public readonly _onDidChangeTextEditorViewColumn: Emitter<vscode.TextEditorViewColumnChangeEvent> = new Emitter();

  public readonly onDidChangeActiveTextEditor: Event<vscode.TextEditor | undefined> =
    this._onDidChangeActiveTextEditor.event;
  public readonly onDidChangeVisibleTextEditors: Event<vscode.TextEditor[]> = this._onDidChangeVisibleTextEditors.event;
  public readonly onDidChangeTextEditorSelection: Event<vscode.TextEditorSelectionChangeEvent> =
    this._onDidChangeTextEditorSelection.event;
  public readonly onDidChangeTextEditorVisibleRanges: Event<vscode.TextEditorVisibleRangesChangeEvent> =
    this._onDidChangeTextEditorVisibleRanges.event;
  public readonly onDidChangeTextEditorOptions: Event<vscode.TextEditorOptionsChangeEvent> =
    this._onDidChangeTextEditorOptions.event;
  public readonly onDidChangeTextEditorViewColumn: Event<vscode.TextEditorViewColumnChangeEvent> =
    this._onDidChangeTextEditorViewColumn.event;

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
        if (!change.actived && created.id === this._activeEditorId) {
          if (this.activeEditor) {
            this._onDidChangeActiveTextEditor.fire(this.activeEditor ? this.activeEditor!.textEditor : undefined);
          }
        }
      });
    }

    if (change.removed) {
      change.removed.forEach((id) => {
        this._editors.delete(id);
      });
    }

    if (change.actived) {
      if (change.actived === '-1') {
        this._activeEditorId = undefined;
        this._onDidChangeActiveTextEditor.fire(undefined);
      } else {
        this._activeEditorId = change.actived;
        if (this.activeEditor) {
          this._onDidChangeActiveTextEditor.fire(this.activeEditor ? this.activeEditor!.textEditor : undefined);
        }
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

  async showTextDocument(
    documentOrUri: vscode.TextDocument | Uri,
    columnOrOptions?: vscode.ViewColumn | vscode.TextDocumentShowOptions,
    preserveFocus?: boolean,
  ): Promise<vscode.TextEditor> {
    let uri: Uri;
    if (Uri.isUri(documentOrUri)) {
      uri = documentOrUri;
    } else {
      uri = documentOrUri.uri;
    }
    let options: IResourceOpenOptions;
    if (typeof columnOrOptions === 'number') {
      options = {
        ...TypeConverts.viewColumnToResourceOpenOptions(columnOrOptions),
        preserveFocus,
      };
    } else if (typeof columnOrOptions === 'object') {
      options = {
        ...TypeConverts.viewColumnToResourceOpenOptions(columnOrOptions.viewColumn),
        preserveFocus: columnOrOptions.preserveFocus,
        range:
          typeof columnOrOptions.selection === 'object'
            ? TypeConverts.Range.from(columnOrOptions.selection)
            : undefined,
        preview: typeof columnOrOptions.preview === 'boolean' ? columnOrOptions.preview : undefined,
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
      return;
    }
    this._proxy.$closeEditor(editor.id);
  }

  getNextId() {
    this.decorationIdCount++;
    return 'textEditor-decoration-' + this.decorationIdCount;
  }

  createTextEditorDecorationType(
    extensionId: string,
    options: vscode.DecorationRenderOptions,
  ): vscode.TextEditorDecorationType {
    const resolved = TypeConverts.DecorationRenderOptions.from(options);
    // 添加 extensionId 以更好定位是哪个插件创建的decoration
    const key = extensionId.replace(/\./g, '-') + '-' + this.getNextId();
    this._proxy.$createTextEditorDecorationType(key, resolved);
    return new ExtHostTextEditorDecorationType(key, this._proxy);
  }

  getDiffInformation(id: string): Promise<vscode.LineChange[]> {
    return Promise.resolve(this._proxy.$getDiffInformation(id));
  }
}

export class ExtHostTextEditorDecorationType extends Disposable implements vscode.TextEditorDecorationType {
  constructor(public readonly key: string, _proxy: IMainThreadEditorsService) {
    super();
    this.addDispose({
      dispose: () => {
        _proxy.$deleteTextEditorDecorationType(key);
      },
    });
  }
}

export class TextEditorData {
  public readonly id: string;

  public readonly group: string;

  constructor(
    created: IEditorCreatedDTO,
    public readonly editorService: ExtensionHostEditorService,
    public readonly documents: ExtensionDocumentDataManager,
  ) {
    this.uri = Uri.parse(created.uri);
    this.id = created.id;
    this._acceptSelections(created.selections);

    this._acceptVisibleRanges(created.visibleRanges);
    this._acceptViewColumn(created.viewColumn);
    this.options = new ExtHostTextEditorOptions(this.editorService._proxy, this.id, created.options);
  }

  readonly uri: Uri;

  selections: vscode.Selection[];

  visibleRanges: vscode.Range[];

  options: ExtHostTextEditorOptions;

  viewColumn?: vscode.ViewColumn | undefined;

  private _textEditor: vscode.TextEditor;

  edit(
    callback: (editBuilder: vscode.TextEditorEdit) => void,
    options: { undoStopBefore: boolean; undoStopAfter: boolean } = { undoStopBefore: true, undoStopAfter: true },
  ): Promise<boolean> {
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
        return Promise.reject(new Error('Overlapping ranges are not allowed!'));
      }
    }

    // prepare data for serialization
    const edits = editData.edits.map(
      (edit): ISingleEditOperation => ({
        range: TypeConverts.Range.from(edit.range),
        text: edit.text,
        forceMoveMarkers: edit.forceMoveMarkers,
      }),
    );

    return this.editorService._proxy.$applyEdits(this.id, editData.documentVersionId, edits, {
      setEndOfLine:
        typeof editData.setEndOfLine === 'number' ? TypeConverts.EndOfLine.from(editData.setEndOfLine) : undefined,
      undoStopBefore: editData.undoStopBefore,
      undoStopAfter: editData.undoStopAfter,
    });
  }

  async insertSnippet(
    snippet: vscode.SnippetString,
    location?: Range | Position | Position[] | Range[] | undefined,
    options?: { undoStopBefore: boolean; undoStopAfter: boolean } | undefined,
  ): Promise<boolean> {
    try {
      let _location: IRange[] = [];
      if (!location || (Array.isArray(location) && location.length === 0)) {
        _location = this.selections.map((s) => TypeConverts.Range.from(s));
      } else if (location instanceof Position) {
        const { lineNumber, column } = TypeConverts.fromPosition(location);
        _location = [
          { startLineNumber: lineNumber, startColumn: column, endLineNumber: lineNumber, endColumn: column },
        ];
      } else if (location instanceof Range) {
        _location = [TypeConverts.Range.from(location)!];
      } else {
        _location = [];
        for (const posOrRange of location) {
          if (posOrRange instanceof Range) {
            _location.push(TypeConverts.Range.from(posOrRange)!);
          } else {
            const { lineNumber, column } = TypeConverts.fromPosition(posOrRange);
            _location.push({
              startLineNumber: lineNumber,
              startColumn: column,
              endLineNumber: lineNumber,
              endColumn: column,
            });
          }
        }
      }
      this.editorService._proxy.$insertSnippet(this.id, snippet.value, _location, options);
      return true;
    } catch (e) {
      getDebugLogger().error(e);
      return false;
    }
  }
  setDecorations(
    decorationType: ExtHostTextEditorDecorationType,
    rangesOrOptions: vscode.Range[] | vscode.DecorationOptions[],
  ): void {
    if (decorationType.disposed) {
      getDebugLogger().warn(`decorationType with key ${decorationType.key} has been disposed!`);
      return;
    }
    let resolved: IDecorationApplyOptions[] = [];
    if (rangesOrOptions.length !== 0) {
      if (Range.isRange(rangesOrOptions[0])) {
        resolved = (rangesOrOptions as vscode.Range[]).map((r) => ({
          range: TypeConverts.Range.from(r),
        }));
      } else if (Range.isRange((rangesOrOptions[0]! as any).range)) {
        resolved = (rangesOrOptions as vscode.DecorationOptions[]).map((r) => ({
          range: TypeConverts.Range.from(r.range),
          renderOptions: r.renderOptions ? TypeConverts.DecorationRenderOptions.from(r.renderOptions) : undefined,
          hoverMessage: r.hoverMessage as any,
        }));
      }
    }
    this.editorService._proxy.$applyDecoration(this.id, decorationType.key, resolved);
  }
  revealRange(range: vscode.Range, revealType?: vscode.TextEditorRevealType | undefined): void {
    this.editorService._proxy.$revealRange(this.id, TypeConverts.Range.from(range), revealType);
  }
  show(column?: vscode.ViewColumn | undefined): void {
    getDebugLogger().warn('TextEditor.show is Deprecated');
  }
  hide(): void {
    this.editorService.closeEditor(this);
  }

  _acceptSelections(selections: ISelection[] = []) {
    this.selections = selections.map((selection) => TypeConverts.Selection.to(selection));
  }

  _acceptOptions(options: IResolvedTextEditorConfiguration) {
    this.options._accept(options);
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

  public doSetSelection: () => void = debounce(
    () => {
      this.editorService._proxy.$setSelections(
        this.id,
        this.selections.map((selection) => TypeConverts.Selection.from(selection)),
      );
    },
    50,
    { maxWait: 200, leading: true, trailing: true },
  );

  get textEditor(): vscode.TextEditor {
    if (!this._textEditor) {
      const data = this;
      this._textEditor = {
        // vscode 有这个属性，但是接口未定义
        get id() {
          return data.id;
        },
        get document() {
          return data.documents.getDocument(data.uri)!;
        },
        set selection(val) {
          data.selections = [val];
          data.doSetSelection();
        },
        get selections() {
          return data.selections;
        },
        set selections(val) {
          data.selections = val;
          data.editorService._proxy.$setSelections(
            data.id,
            data.selections.map((selection) => TypeConverts.Selection.from(selection)),
          );
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
        set options(value: vscode.TextEditorOptions) {
          data.options.assign(value);
          //
        },
        edit: data.edit.bind(data),
        insertSnippet: data.insertSnippet.bind(data),
        setDecorations: data.setDecorations.bind(data),
        revealRange: data.revealRange.bind(data),
        show: data.show.bind(data),
        hide: data.hide.bind(data),
      } as vscode.TextEditor;
    }
    return this._textEditor;
  }
}

export function toIRange(range: vscode.Range | vscode.Selection | vscode.Position): IRange {
  if (Range.isRange(range)) {
    // vscode.Range
    return TypeConverts.Range.from(range);
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

export class ExtHostTextEditorOptions implements vscode.TextEditorOptions {
  private _proxy: IMainThreadEditorsService;
  private _id: string;

  private _tabSize: number;
  private _indentSize: number;
  private _insertSpaces: boolean;
  private _cursorStyle: TextEditorCursorStyle;
  private _lineNumbers: TextEditorLineNumbersStyle;

  constructor(proxy: IMainThreadEditorsService, id: string, source: IResolvedTextEditorConfiguration) {
    this._proxy = proxy;
    this._id = id;
    this._accept(source);
  }

  public _accept(source: IResolvedTextEditorConfiguration): void {
    this._tabSize = source.tabSize;
    this._indentSize = source.indentSize;
    this._insertSpaces = source.insertSpaces;
    this._cursorStyle = source.cursorStyle;
    this._lineNumbers = TypeConverts.TextEditorLineNumbersStyle.to(source.lineNumbers);
  }

  public get tabSize(): number | string {
    return this._tabSize;
  }

  public set tabSize(value: number | string) {
    const tabSize = this._validateTabSize(value);
    if (tabSize === null) {
      // ignore invalid call
      return;
    }
    if (typeof tabSize === 'number') {
      if (this._tabSize === tabSize) {
        // nothing to do
        return;
      }
      // reflect the new tabSize value immediately
      this._tabSize = tabSize;
    }
    this._proxy.$updateOptions(this._id, {
      tabSize,
    });
  }

  private _validateTabSize(value: number | string): number | 'auto' | null {
    if (value === 'auto') {
      return 'auto';
    }
    if (typeof value === 'number') {
      const r = Math.floor(value);
      return r > 0 ? r : null;
    }
    if (typeof value === 'string') {
      const r = parseInt(value, 10);
      if (isNaN(r)) {
        return null;
      }
      return r > 0 ? r : null;
    }
    return null;
  }

  public get indentSize(): number | string {
    return this._indentSize;
  }

  public set indentSize(value: number | string) {
    const indentSize = this._validateIndentSize(value);
    if (indentSize === null) {
      // ignore invalid call
      return;
    }
    if (typeof indentSize === 'number') {
      if (this._indentSize === indentSize) {
        // nothing to do
        return;
      }
      // reflect the new indentSize value immediately
      this._indentSize = indentSize;
    }
    this._proxy.$updateOptions(this._id, {
      indentSize,
    });
  }

  private _validateIndentSize(value: number | string): number | 'tabSize' | null {
    if (value === 'tabSize') {
      return 'tabSize';
    }
    if (typeof value === 'number') {
      const r = Math.floor(value);
      return r > 0 ? r : null;
    }
    if (typeof value === 'string') {
      const r = parseInt(value, 10);
      if (isNaN(r)) {
        return null;
      }
      return r > 0 ? r : null;
    }
    return null;
  }

  public get insertSpaces(): boolean | string {
    return this._insertSpaces;
  }

  public set insertSpaces(value: boolean | string) {
    const insertSpaces = this._validateInsertSpaces(value);
    if (typeof insertSpaces === 'boolean') {
      if (this._insertSpaces === insertSpaces) {
        // nothing to do
        return;
      }
      // reflect the new insertSpaces value immediately
      this._insertSpaces = insertSpaces;
    }
    this._proxy.$updateOptions(this._id, {
      insertSpaces,
    });
  }

  private _validateInsertSpaces(value: boolean | string): boolean | 'auto' {
    if (value === 'auto') {
      return 'auto';
    }
    return value === 'false' ? false : Boolean(value);
  }

  public get cursorStyle(): TextEditorCursorStyle {
    return this._cursorStyle;
  }

  public set cursorStyle(value: TextEditorCursorStyle) {
    if (this._cursorStyle === value) {
      // nothing to do
      return;
    }
    this._cursorStyle = value;
    this._proxy.$updateOptions(this._id, {
      cursorStyle: value,
    });
  }

  public get lineNumbers(): TextEditorLineNumbersStyle {
    return this._lineNumbers;
  }

  public set lineNumbers(value: TextEditorLineNumbersStyle) {
    if (this._lineNumbers === value) {
      // nothing to do
      return;
    }
    this._lineNumbers = value;
    this._proxy.$updateOptions(this._id, {
      lineNumbers: TypeConverts.TextEditorLineNumbersStyle.from(value),
    });
  }

  public assign(newOptions: vscode.TextEditorOptions) {
    const bulkConfigurationUpdate: ITextEditorUpdateConfiguration = {};
    let hasUpdate = false;

    if (typeof newOptions.tabSize !== 'undefined') {
      const tabSize = this._validateTabSize(newOptions.tabSize);
      if (tabSize === 'auto') {
        hasUpdate = true;
        bulkConfigurationUpdate.tabSize = tabSize;
      } else if (typeof tabSize === 'number' && this._tabSize !== tabSize) {
        // reflect the new tabSize value immediately
        this._tabSize = tabSize;
        hasUpdate = true;
        bulkConfigurationUpdate.tabSize = tabSize;
      }
    }

    // if (typeof newOptions.indentSize !== 'undefined') {
    // 	const indentSize = this._validateIndentSize(newOptions.indentSize);
    // 	if (indentSize === 'tabSize') {
    // 		hasUpdate = true;
    // 		bulkConfigurationUpdate.indentSize = indentSize;
    // 	} else if (typeof indentSize === 'number' && this._indentSize !== indentSize) {
    // 		// reflect the new indentSize value immediately
    // 		this._indentSize = indentSize;
    // 		hasUpdate = true;
    // 		bulkConfigurationUpdate.indentSize = indentSize;
    // 	}
    // }

    if (typeof newOptions.insertSpaces !== 'undefined') {
      const insertSpaces = this._validateInsertSpaces(newOptions.insertSpaces);
      if (insertSpaces === 'auto') {
        hasUpdate = true;
        bulkConfigurationUpdate.insertSpaces = insertSpaces;
      } else if (this._insertSpaces !== insertSpaces) {
        // reflect the new insertSpaces value immediately
        this._insertSpaces = insertSpaces;
        hasUpdate = true;
        bulkConfigurationUpdate.insertSpaces = insertSpaces;
      }
    }

    if (typeof newOptions.cursorStyle !== 'undefined') {
      if (this._cursorStyle !== newOptions.cursorStyle) {
        this._cursorStyle = newOptions.cursorStyle;
        hasUpdate = true;
        bulkConfigurationUpdate.cursorStyle = newOptions.cursorStyle;
      }
    }

    if (typeof newOptions.lineNumbers !== 'undefined') {
      if (this._lineNumbers !== newOptions.lineNumbers) {
        this._lineNumbers = newOptions.lineNumbers;
        hasUpdate = true;
        bulkConfigurationUpdate.lineNumbers = TypeConverts.TextEditorLineNumbersStyle.from(newOptions.lineNumbers);
      }
    }

    if (hasUpdate) {
      this._proxy.$updateOptions(this._id, bulkConfigurationUpdate);
    }
  }
}

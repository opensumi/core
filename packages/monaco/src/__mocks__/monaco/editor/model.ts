import { MockedMonacoUri } from '../common/uri';
import { Disposable, Emitter } from '@ali/ide-core-common';
import { EOL, EndOfLineSequence } from '@ali/ide-editor';

let id = 1;

const eolStringMap = new Map<number, string>([
  [ EndOfLineSequence.LF, EOL.LF ],
  [ EndOfLineSequence.CRLF, EOL.CRLF ],
]);

export class MockedMonacoModel extends Disposable implements monaco.editor.ITextModel {

  id: string;
  _lines: string[];
  uri: monaco.Uri;
  language: string;

  _onDidChangeContent = new Emitter<monaco.editor.IModelContentChangedEvent>();
  onDidChangeContent = this._onDidChangeContent.event;

  _onDidChangeDecorations = new Emitter<monaco.editor.IModelDecorationsChangedEvent>();
  onDidChangeDecorations = this._onDidChangeDecorations.event;

  _onDidChangeOptions = new Emitter<monaco.editor.IModelOptionsChangedEvent>();
  onDidChangeOptions = this._onDidChangeOptions.event;

  _onDidChangeLanguage = new Emitter<monaco.editor.IModelLanguageChangedEvent>();
  onDidChangeLanguage = this._onDidChangeLanguage.event;

  _onDidChangeLanguageConfiguration = new Emitter<monaco.editor.IModelLanguageConfigurationChangedEvent>();
  onDidChangeLanguageConfiguration = this._onDidChangeLanguageConfiguration.event;

  _onWillDispose = new Emitter<void>();
  onWillDispose = this._onWillDispose.event;

  private versionId = 0;
  private eol: monaco.editor.EndOfLineSequence = EndOfLineSequence.LF as any;
  private value: string;

  options: monaco.editor.TextModelResolvedOptions;

  constructor(value, language, uri?: monaco.Uri) {
    super();
    this.id = 'mocked.model.' + (id++).toString();
    this._lines = value.split('\n');
    this.uri = uri || MockedMonacoUri.parse('inmemory://' + (id).toString());
    this.language = language;
    this.value = value;
  }

  getOptions(): monaco.editor.TextModelResolvedOptions {
    return this.options;
  }

  getVersionId(): number {
    return this.versionId;
  }

  getAlternativeVersionId(): number {
    return this.versionId;
  }
  setValue(newValue: string): void {
    const oldValue = this.value;
    this.value = newValue;
    this.versionId++;

    this._onDidChangeContent.fire({
      changes: [{
        range: {
          startColumn: oldValue.length,
          endColumn: newValue.length,
          startLineNumber: 0,
          endLineNumber: 0,
        },
        rangeOffset: oldValue.length,
        rangeLength: newValue.length - oldValue.length,
        text: newValue.substr(oldValue.length),
      }],
      eol: this.getEOL(),
      versionId: this.versionId,
      isUndoing: false,
      isRedoing: false,
      isFlush: true,
    });
  }

  getValue(eol?: monaco.editor.EndOfLinePreference | undefined, preserveBOM?: boolean | undefined): string {
    return this.value;
  }

  getValueLength(eol?: monaco.editor.EndOfLinePreference | undefined, preserveBOM?: boolean | undefined): number {
    throw new Error('Method not implemented.');
  }
  getValueInRange(range: monaco.IRange, eol?: monaco.editor.EndOfLinePreference | undefined): string {
    throw new Error('Method not implemented.');
  }
  getValueLengthInRange(range: monaco.IRange): number {
    throw new Error('Method not implemented.');
  }
  getLineCount(): number {
    throw new Error('Method not implemented.');
  }
  getLineContent(lineNumber: number): string {
    throw new Error('Method not implemented.');
  }
  getLineLength(lineNumber: number): number {
    throw new Error('Method not implemented.');
  }
  getLinesContent(): string[] {
    throw new Error('Method not implemented.');
  }
  getEOL(): string {
    return eolStringMap.get(this.eol)!;
  }
  getLineMinColumn(lineNumber: number): number {
    throw new Error('Method not implemented.');
  }
  getLineMaxColumn(lineNumber: number): number {
    throw new Error('Method not implemented.');
  }
  getLineFirstNonWhitespaceColumn(lineNumber: number): number {
    throw new Error('Method not implemented.');
  }
  getLineLastNonWhitespaceColumn(lineNumber: number): number {
    throw new Error('Method not implemented.');
  }
  validatePosition(position: monaco.IPosition): monaco.Position {
    throw new Error('Method not implemented.');
  }
  modifyPosition(position: monaco.IPosition, offset: number): monaco.Position {
    throw new Error('Method not implemented.');
  }
  validateRange(range: monaco.IRange): monaco.Range {
    throw new Error('Method not implemented.');
  }
  getOffsetAt(position: monaco.IPosition): number {
    throw new Error('Method not implemented.');
  }
  getPositionAt(offset: number): monaco.Position {
    throw new Error('Method not implemented.');
  }
  getFullModelRange(): monaco.Range {
    return { startLineNumber: 4, startColumn: 1, endLineNumber: 9, endColumn: 8 } as monaco.Range;
  }
  isDisposed(): boolean {
    throw new Error('Method not implemented.');
  }

  findMatches(searchString: any, searchScope: any, isRegex: any, matchCase: any, wordSeparators: any, captureMatches: any, limitResultCount?: any) {
    throw new Error('Method not implemented.');
    return [];
  }
  findNextMatch(searchString: string, searchStart: monaco.IPosition, isRegex: boolean, matchCase: boolean, wordSeparators: string | null, captureMatches: boolean): monaco.editor.FindMatch | null {
    throw new Error('Method not implemented.');
  }
  findPreviousMatch(searchString: string, searchStart: monaco.IPosition, isRegex: boolean, matchCase: boolean, wordSeparators: string | null, captureMatches: boolean): monaco.editor.FindMatch | null {
    throw new Error('Method not implemented.');
  }
  getModeId(): string {
    return this.language;
  }
  getWordAtPosition(position: monaco.IPosition): monaco.editor.IWordAtPosition | null {
    throw new Error('Method not implemented.');
  }
  getWordUntilPosition(position: monaco.IPosition): monaco.editor.IWordAtPosition {
    throw new Error('Method not implemented.');
  }
  deltaDecorations(oldDecorations: string[], newDecorations: monaco.editor.IModelDeltaDecoration[], ownerId?: number | undefined): string[] {
    throw new Error('Method not implemented.');
  }
  getDecorationOptions(id: string): monaco.editor.IModelDecorationOptions | null {
    throw new Error('Method not implemented.');
  }
  getDecorationRange(id: string): monaco.Range | null {
    throw new Error('Method not implemented.');
  }
  getLineDecorations(lineNumber: number, ownerId?: number | undefined, filterOutValidation?: boolean | undefined): monaco.editor.IModelDecoration[] {
    throw new Error('Method not implemented.');
  }
  getLinesDecorations(startLineNumber: number, endLineNumber: number, ownerId?: number | undefined, filterOutValidation?: boolean | undefined): monaco.editor.IModelDecoration[] {
    throw new Error('Method not implemented.');
  }
  getDecorationsInRange(range: monaco.IRange, ownerId?: number | undefined, filterOutValidation?: boolean | undefined): monaco.editor.IModelDecoration[] {
    throw new Error('Method not implemented.');
  }
  getAllDecorations(ownerId?: number | undefined, filterOutValidation?: boolean | undefined): monaco.editor.IModelDecoration[] {
    throw new Error('Method not implemented.');
  }
  getOverviewRulerDecorations(ownerId?: number | undefined, filterOutValidation?: boolean | undefined): monaco.editor.IModelDecoration[] {
    throw new Error('Method not implemented.');
  }
  normalizeIndentation(str: string): string {
    throw new Error('Method not implemented.');
  }
  updateOptions(newOpts: monaco.editor.ITextModelUpdateOptions): void {
    throw new Error('Method not implemented.');
  }
  detectIndentation(defaultInsertSpaces: boolean, defaultTabSize: number): void {
    throw new Error('Method not implemented.');
  }
  pushStackElement(): void {
    throw new Error('Method not implemented.');
  }
  pushEditOperations(beforeCursorState: monaco.Selection[], editOperations: monaco.editor.IIdentifiedSingleEditOperation[], cursorStateComputer: monaco.editor.ICursorStateComputer): monaco.Selection[] | null {
    throw new Error('Method not implemented.');
  }
  pushEOL(eol: monaco.editor.EndOfLineSequence): void {
    throw new Error('Method not implemented.');
  }
  applyEdits(operations: monaco.editor.IIdentifiedSingleEditOperation[]): monaco.editor.IIdentifiedSingleEditOperation[] {
    for (const operation of operations) {
      this.value =
        this.value.substr(0, operation.range.startColumn) +
        operation.text +
        this.value.substr(operation.range.endColumn);

      this.versionId++;

      this._onDidChangeContent.fire({
        changes: [{
          range: operation.range,
          rangeOffset: operation.range.startColumn,
          rangeLength: operation.range.endColumn - operation.range.startColumn,
          text: operation.text || '',
        }],
        eol: this.getEOL(),
        versionId: this.versionId,
        isUndoing: false,
        isRedoing: false,
        isFlush: true,
      });
    }

    return [];
  }
  setEOL(eol: monaco.editor.EndOfLineSequence): void {
    this.eol = eol;
  }

}

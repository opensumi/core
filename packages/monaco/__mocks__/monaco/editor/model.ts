import { Disposable, Emitter, Event } from '@opensumi/ide-core-common';
import { IValidEditOperation } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import { EndOfLineSequence, EOL } from '../../../src/browser/monaco-api/types';
import { MockedMonacoUri } from '../common/uri';


let id = 1;

const eolStringMap = new Map<number, string>([
  [EndOfLineSequence.LF, EOL.LF],
  [EndOfLineSequence.CRLF, EOL.CRLF],
]);

export class MockedMonacoModel extends Disposable implements monaco.editor.ITextModel {
  id: string;
  _lines: string[];
  uri: monaco.Uri;
  language: string;
  _isDisposed = false;

  // 获取上一个版本内容供 editorWorkerService 用
  oldValue: string;

  _onDidChangeContent = new Emitter<monaco.editor.IModelContentChangedEvent>();
  onDidChangeContent: Event<monaco.editor.IModelContentChangedEvent> = this._onDidChangeContent.event;

  _onDidChangeDecorations = new Emitter<monaco.editor.IModelDecorationsChangedEvent>();
  onDidChangeDecorations: Event<monaco.editor.IModelDecorationsChangedEvent> = this._onDidChangeDecorations.event;

  _onDidChangeOptions = new Emitter<monaco.editor.IModelOptionsChangedEvent>();
  onDidChangeOptions: Event<monaco.editor.IModelOptionsChangedEvent> = this._onDidChangeOptions.event;

  _onDidChangeLanguage = new Emitter<monaco.editor.IModelLanguageChangedEvent>();
  onDidChangeLanguage: Event<monaco.editor.IModelLanguageChangedEvent> = this._onDidChangeLanguage.event;

  _onDidChangeLanguageConfiguration = new Emitter<monaco.editor.IModelLanguageConfigurationChangedEvent>();
  onDidChangeLanguageConfiguration: Event<monaco.editor.IModelLanguageConfigurationChangedEvent> =
    this._onDidChangeLanguageConfiguration.event;

  _onWillDispose = new Emitter<void>();
  onWillDispose: Event<void> = this._onWillDispose.event;

  private versionId = 0;
  private eol: monaco.editor.EndOfLineSequence = EndOfLineSequence.LF as any;
  private value: string;

  options: monaco.editor.TextModelResolvedOptions = {
    tabSize: 2,
    _textModelResolvedOptionsBrand: void 0,
    indentSize: 0,
    insertSpaces: true,
    defaultEOL: 1,
    trimAutoWhitespace: false,
    equals() {
      return true;
    },
    createChangeEvent(newOpts: monaco.editor.TextModelResolvedOptions) {
      return {
        tabSize: true,
        indentSize: true,
        insertSpaces: true,
        trimAutoWhitespace: true,
      };
    },
    bracketPairColorizationOptions: {
      enabled: true,
    },
  };

  constructor(value, language, uri?: monaco.Uri) {
    super();
    this.id = 'mocked.model.' + (id++).toString();
    this._lines = value.split('\n');
    this.uri = uri || MockedMonacoUri.parse('inmemory://' + id.toString());
    this.language = language;
    this.value = value;
  }
  mightContainUnusualLineTerminators(): boolean {
    throw new Error('Method not implemented.');
  }
  removeUnusualLineTerminators(selections?: monaco.Selection[]): void {
    throw new Error('Method not implemented.');
  }
  getTextBuffer(): monaco.editor.ITextBuffer {
    throw new Error('Method not implemented.');
  }
  getEndOfLineSequence(): monaco.editor.EndOfLineSequence {
    throw new Error('Method not implemented.');
  }
  setPartialSemanticTokens(range: monaco.Range, tokens: any[] | null): void {
    throw new Error('Method not implemented.');
  }
  hasCompleteSemanticTokens(): boolean {
    throw new Error('Method not implemented.');
  }
  hasSomeSemanticTokens(): boolean {
    throw new Error('Method not implemented.');
  }
  getInjectedTextDecorations(ownerId?: number): monaco.editor.IModelDecoration[] {
    throw new Error('Method not implemented.');
  }
  _setTrackedRange(id: string | null, newRange: null, newStickiness: monaco.editor.TrackedRangeStickiness): null;
  _setTrackedRange(
    id: string | null,
    newRange: monaco.Range,
    newStickiness: monaco.editor.TrackedRangeStickiness,
  ): string;
  _setTrackedRange(id: any, newRange: any, newStickiness: any): string | null {
    throw new Error('Method not implemented.');
  }
  popStackElement(): void {
    throw new Error('Method not implemented.');
  }
  _applyUndo(
    changes: any[],
    eol: monaco.editor.EndOfLineSequence,
    resultingAlternativeVersionId: number,
    resultingSelection: monaco.Selection[] | null,
  ): void {
    throw new Error('Method not implemented.');
  }
  _applyRedo(
    changes: any[],
    eol: monaco.editor.EndOfLineSequence,
    resultingAlternativeVersionId: number,
    resultingSelection: monaco.Selection[] | null,
  ): void {
    throw new Error('Method not implemented.');
  }
  onDidChangeContentOrInjectedText(listener: (e: any) => void): monaco.IDisposable {
    throw new Error('Method not implemented.');
  }
  normalizePosition(position: monaco.Position, affinity: any): monaco.Position {
    throw new Error('Method not implemented.');
  }
  getLineIndentColumn(lineNumber: number): number {
    throw new Error('Method not implemented.');
  }
  isForSimpleWidget: boolean;
  mightContainRTL(): boolean {
    throw new Error('Method not implemented.');
  }
  mightContainNonBasicASCII(): boolean {
    throw new Error('Method not implemented.');
  }
  getFormattingOptions(): monaco.languages.FormattingOptions {
    throw new Error('Method not implemented.');
  }
  setValueFromTextBuffer(newValue: monaco.editor.ITextBuffer): void {
    throw new Error('Method not implemented.');
  }
  createSnapshot(preserveBOM?: boolean): monaco.editor.ITextSnapshot {
    throw new Error('Method not implemented.');
  }
  equalsTextBuffer(other: monaco.editor.ITextBuffer): boolean {
    throw new Error('Method not implemented.');
  }
  isDominatedByLongLines(): boolean {
    throw new Error('Method not implemented.');
  }
  tokenizeViewport(startLineNumber: number, endLineNumber: number): void {
    throw new Error('Method not implemented.');
  }
  isTooLargeForSyncing(): boolean {
    throw new Error('Method not implemented.');
  }
  isTooLargeForTokenization(): boolean {
    throw new Error('Method not implemented.');
  }
  setTokens(tokens: any[]): void {
    throw new Error('Method not implemented.');
  }
  setSemanticTokens(tokens: any[] | null): void {
    throw new Error('Method not implemented.');
  }
  resetTokenization(): void {
    throw new Error('Method not implemented.');
  }
  forceTokenization(lineNumber: number): void {
    throw new Error('Method not implemented.');
  }
  tokenizeIfCheap(lineNumber: number): void {
    throw new Error('Method not implemented.');
  }
  isCheapToTokenize(lineNumber: number): boolean {
    throw new Error('Method not implemented.');
  }
  getLineTokens(lineNumber: number) {
    throw new Error('Method not implemented.');
  }
  getLanguageIdentifier() {
    throw new Error('Method not implemented.');
  }
  setMode(languageIdentifier: any): void {
    throw new Error('Method not implemented.');
  }
  getLanguageIdAtPosition(lineNumber: number, column: number) {
    throw new Error('Method not implemented.');
  }
  findMatchingBracketUp(bracket: string, position: monaco.IPosition): monaco.Range | null {
    throw new Error('Method not implemented.');
  }
  findPrevBracket(position: monaco.IPosition): monaco.editor.IFoundBracket | null {
    throw new Error('Method not implemented.');
  }
  findNextBracket(position: monaco.IPosition): monaco.editor.IFoundBracket | null {
    throw new Error('Method not implemented.');
  }
  findEnclosingBrackets(position: monaco.IPosition, maxDuration?: number): [monaco.Range, monaco.Range] | null {
    throw new Error('Method not implemented.');
  }
  matchBracket(position: monaco.IPosition): [monaco.Range, monaco.Range] | null {
    throw new Error('Method not implemented.');
  }
  getActiveIndentGuide(
    lineNumber: number,
    minLineNumber: number,
    maxLineNumber: number,
  ): monaco.editor.IActiveIndentGuideInfo {
    throw new Error('Method not implemented.');
  }
  getLinesIndentGuides(startLineNumber: number, endLineNumber: number): number[] {
    throw new Error('Method not implemented.');
  }
  changeDecorations<T>(
    callback: (changeAccessor: monaco.editor.IModelDecorationsChangeAccessor) => T,
    ownerId?: number,
  ): T | null {
    throw new Error('Method not implemented.');
  }
  removeAllDecorationsWithOwnerId(ownerId: number): void {
    throw new Error('Method not implemented.');
  }
  _getTrackedRange(id: string): monaco.Range | null {
    throw new Error('Method not implemented.');
  }
  undo() {
    return;
  }
  canUndo(): boolean {
    return true;
  }
  redo() {
    return;
  }
  canRedo(): boolean {
    throw new Error('Method not implemented.');
  }
  onDidChangeRawContentFast(listener: (e: any) => void): monaco.IDisposable {
    throw new Error('Method not implemented.');
  }
  onDidChangeRawContent(listener: (e: any) => void): monaco.IDisposable {
    throw new Error('Method not implemented.');
  }
  onDidChangeTokens(listener: (e: monaco.editor.IModelTokensChangedEvent) => void): monaco.IDisposable {
    throw new Error('Method not implemented.');
  }
  onDidChangeAttached(listener: () => void): monaco.IDisposable {
    throw new Error('Method not implemented.');
  }
  onBeforeAttached(): void {
    throw new Error('Method not implemented.');
  }
  onBeforeDetached(): void {
    throw new Error('Method not implemented.');
  }
  isAttachedToEditor(): boolean {
    throw new Error('Method not implemented.');
  }
  getAttachedEditorCount(): number {
    throw new Error('Method not implemented.');
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
    this.oldValue = oldValue;
    this.value = newValue;
    this.versionId++;

    this._onDidChangeContent.fire({
      changes: [
        {
          range: {
            startColumn: oldValue.length,
            endColumn: newValue.length,
            startLineNumber: 0,
            endLineNumber: 0,
          },
          rangeOffset: oldValue.length,
          rangeLength: newValue.length - oldValue.length,
          text: newValue.substr(oldValue.length),
        },
      ],
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
    return this.value ? this.value.length : 0;
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
  getLinesBracketGuides(
    startLineNumber: number,
    endLineNumber: number,
    activePosition: monaco.Position | null,
    highlightActiveGuides: boolean,
    includeNonActiveGuides: boolean,
  ): any[][] {
    throw new Error('Method not implemented.');
  }
  isDisposed(): boolean {
    return this._isDisposed;
  }

  findMatches(
    searchString: any,
    searchScope: any,
    isRegex: any,
    matchCase: any,
    wordSeparators: any,
    captureMatches: any,
    limitResultCount?: any,
  ) {
    throw new Error('Method not implemented.');
    return [];
  }
  findNextMatch(
    searchString: string,
    searchStart: monaco.IPosition,
    isRegex: boolean,
    matchCase: boolean,
    wordSeparators: string | null,
    captureMatches: boolean,
  ): monaco.editor.FindMatch | null {
    throw new Error('Method not implemented.');
  }
  findPreviousMatch(
    searchString: string,
    searchStart: monaco.IPosition,
    isRegex: boolean,
    matchCase: boolean,
    wordSeparators: string | null,
    captureMatches: boolean,
  ): monaco.editor.FindMatch | null {
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
  deltaDecorations(
    oldDecorations: string[],
    newDecorations: monaco.editor.IModelDeltaDecoration[],
    ownerId?: number | undefined,
  ): string[] {
    // eslint-disable-next-line no-console
    console.log('deltaDecorations was called');
    if (oldDecorations.length === 0 && newDecorations.length === 0) {
      // nothing to do
      return [];
    }
    return newDecorations.map((_, i) => 'deco_IntervalNode' + i);
  }

  getDecorationOptions(id: string): monaco.editor.IModelDecorationOptions | null {
    throw new Error('Method not implemented.');
  }
  getDecorationRange(id: string): monaco.Range | null {
    throw new Error('Method not implemented.');
  }
  getLineDecorations(
    lineNumber: number,
    ownerId?: number | undefined,
    filterOutValidation?: boolean | undefined,
  ): monaco.editor.IModelDecoration[] {
    throw new Error('Method not implemented.');
  }
  getLinesDecorations(
    startLineNumber: number,
    endLineNumber: number,
    ownerId?: number | undefined,
    filterOutValidation?: boolean | undefined,
  ): monaco.editor.IModelDecoration[] {
    throw new Error('Method not implemented.');
  }
  getDecorationsInRange(
    range: monaco.IRange,
    ownerId?: number | undefined,
    filterOutValidation?: boolean | undefined,
  ): monaco.editor.IModelDecoration[] {
    throw new Error('Method not implemented.');
  }
  getAllDecorations(
    ownerId?: number | undefined,
    filterOutValidation?: boolean | undefined,
  ): monaco.editor.IModelDecoration[] {
    throw new Error('Method not implemented.');
  }
  getOverviewRulerDecorations(
    ownerId?: number | undefined,
    filterOutValidation?: boolean | undefined,
  ): monaco.editor.IModelDecoration[] {
    throw new Error('Method not implemented.');
  }
  normalizeIndentation(str: string): string {
    throw new Error('Method not implemented.');
  }
  updateOptions(newOpts: monaco.editor.ITextModelUpdateOptions): void {
    this.options = {
      ...this.options,
      ...newOpts,
      equals() {
        return true;
      },
      createChangeEvent(newOpts: monaco.editor.TextModelResolvedOptions) {
        return {
          tabSize: true,
          indentSize: true,
          insertSpaces: true,
          trimAutoWhitespace: true,
        };
      },
    };
    // @ts-ignore
    this._onDidChangeOptions.fire(this.options);
  }
  detectIndentation(defaultInsertSpaces: boolean, defaultTabSize: number): void {
    return;
  }
  pushStackElement = jest.fn();

  pushEditOperations = jest.fn();

  pushEOL = jest.fn();

  applyEdits(operations: monaco.editor.IIdentifiedSingleEditOperation[]): IValidEditOperation[] {
    for (const operation of operations) {
      this.value =
        this.value.substr(0, operation.range.startColumn) +
        operation.text +
        this.value.substr(operation.range.endColumn);

      this.versionId++;

      this._onDidChangeContent.fire({
        changes: [
          {
            range: operation.range,
            rangeOffset: operation.range.startColumn,
            rangeLength: operation.range.endColumn - operation.range.startColumn,
            text: operation.text || '',
          },
        ],
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
  getCharacterCountInRange(range: monaco.IRange): number {
    return 0;
  }
}

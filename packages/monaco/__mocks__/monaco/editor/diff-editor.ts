import { Disposable, Event } from '@opensumi/ide-core-common';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import { MockedStandaloneCodeEditor } from './code-editor';

export class MockedDiffEditor extends Disposable implements monaco.editor.IStandaloneDiffEditor {
  private originalEditor: MockedStandaloneCodeEditor;
  private modifiedEditor: MockedStandaloneCodeEditor;
  onDidDispose: Event<void>;

  private model: monaco.editor.IDiffEditorModel | null;

  constructor(public dom, public options, public override) {
    super();
    this.originalEditor = new MockedStandaloneCodeEditor(dom, options, override);
    this.modifiedEditor = new MockedStandaloneCodeEditor(dom, options, override);
    this.onDidDispose = this.onDispose;
  }
  revealLineNearTop(lineNumber: number, scrollType?: monaco.editor.ScrollType): void {
    throw new Error('Method not implemented.');
  }
  revealPositionNearTop(position: monaco.IPosition, scrollType?: monaco.editor.ScrollType): void {
    throw new Error('Method not implemented.');
  }
  revealLinesNearTop(lineNumber: number, endLineNumber: number, scrollType?: monaco.editor.ScrollType): void {
    throw new Error('Method not implemented.');
  }
  revealRangeNearTop(range: monaco.IRange, scrollType?: monaco.editor.ScrollType): void {
    throw new Error('Method not implemented.');
  }
  revealRangeNearTopIfOutsideViewport(range: monaco.IRange, scrollType?: monaco.editor.ScrollType): void {
    throw new Error('Method not implemented.');
  }
  ignoreTrimWhitespace: boolean;
  renderSideBySide: boolean;
  renderIndicators: boolean;
  maxComputationTime: number;
  getDiffComputationResult() {
    throw new Error('Method not implemented.');
  }
  onVisible(): void {
    throw new Error('Method not implemented.');
  }
  onHide(): void {
    throw new Error('Method not implemented.');
  }
  getStatusbarColumn(position: monaco.IPosition): number {
    throw new Error('Method not implemented.');
  }
  changeDecorations(callback: (changeAccessor: monaco.editor.IModelDecorationsChangeAccessor) => any) {
    throw new Error('Method not implemented.');
  }

  addCommand(keybinding: number, handler: monaco.editor.ICommandHandler, context?: string | undefined): string | null {
    return null;
  }

  createContextKey<T>(key: string, defaultValue: T): monaco.editor.IContextKey<T> {
    throw new Error('Method not implemented.');
  }
  addAction(descriptor: monaco.editor.IActionDescriptor): monaco.IDisposable {
    throw new Error('Method not implemented.');
  }
  getOriginalEditor(): monaco.editor.IStandaloneCodeEditor {
    return this.originalEditor;
  }
  getModifiedEditor(): monaco.editor.IStandaloneCodeEditor {
    return this.modifiedEditor;
  }
  getDomNode(): HTMLElement {
    return this.dom;
  }
  onDidUpdateDiff(listener: () => void): monaco.IDisposable {
    throw new Error('Method not implemented.');
  }
  saveViewState(): monaco.editor.IDiffEditorViewState | null {
    throw new Error('Method not implemented.');
  }
  restoreViewState(state: monaco.editor.IDiffEditorViewState): void {
    throw new Error('Method not implemented.');
  }
  getModel(): monaco.editor.IDiffEditorModel | null {
    return this.model;
  }
  setModel(model: monaco.editor.IDiffEditorModel | null): void {
    this.model = model;
  }
  getLineChanges(): monaco.editor.ILineChange[] | null {
    return null;
  }
  getDiffLineInformationForOriginal(lineNumber: number): monaco.editor.IDiffLineInformation | null {
    return null;
  }
  getDiffLineInformationForModified(lineNumber: number): monaco.editor.IDiffLineInformation | null {
    return null;
  }
  getId(): string {
    return 'diffId';
  }
  getEditorType(): string {
    return 'diff';
  }
  updateOptions(newOptions: monaco.editor.IEditorOptions): void {
    this.options = newOptions;
  }
  layout(dimension?: monaco.editor.IDimension | undefined): void {
    return;
  }
  focus(): void {
    return;
  }
  hasTextFocus(): boolean {
    return false;
  }
  getSupportedActions(): monaco.editor.IEditorAction[] {
    return [];
  }
  getVisibleColumnFromPosition(position: monaco.IPosition): number {
    return 1;
  }
  getPosition(): monaco.Position | null {
    return this.modifiedEditor.getPosition();
  }
  setPosition(position: monaco.Position): void {
    this.modifiedEditor.setPosition(position);
  }
  revealLine(lineNumber: number, scrollType?: monaco.editor.ScrollType | undefined): void {
    this.modifiedEditor.revealLine(lineNumber, scrollType);
  }
  revealLineInCenter(lineNumber: number, scrollType?: monaco.editor.ScrollType | undefined): void {
    this.modifiedEditor.revealLineInCenter(lineNumber);
  }
  revealLineInCenterIfOutsideViewport(lineNumber: number, scrollType?: monaco.editor.ScrollType | undefined): void {
    this.modifiedEditor.revealLineInCenterIfOutsideViewport(lineNumber, scrollType);
  }
  revealPosition(position: monaco.IPosition, scrollType?: monaco.editor.ScrollType | undefined): void {
    this.modifiedEditor.revealPosition(position, scrollType);
  }
  revealPositionInCenter(position: monaco.IPosition, scrollType?: monaco.editor.ScrollType | undefined): void {
    this.modifiedEditor.revealPositionInCenter(position, scrollType);
  }
  revealPositionInCenterIfOutsideViewport(
    position: monaco.IPosition,
    scrollType?: monaco.editor.ScrollType | undefined,
  ): void {
    this.modifiedEditor.revealPositionInCenterIfOutsideViewport(position, scrollType);
  }
  getSelection(): monaco.Selection | null {
    return this.modifiedEditor.getSelection();
  }
  getSelections(): monaco.Selection[] | null {
    return this.modifiedEditor.getSelections();
  }
  setSelection(selection: any) {
    this.modifiedEditor.setSelection(selection);
  }
  setSelections(selections: monaco.ISelection[]): void {
    this.modifiedEditor.setSelections(selections);
  }
  revealLines(startLineNumber: number, endLineNumber: number, scrollType?: monaco.editor.ScrollType | undefined): void {
    this.modifiedEditor.revealLines(startLineNumber, endLineNumber, scrollType);
  }
  revealLinesInCenter(
    lineNumber: number,
    endLineNumber: number,
    scrollType?: monaco.editor.ScrollType | undefined,
  ): void {
    this.modifiedEditor.revealLinesInCenter(lineNumber, endLineNumber, scrollType);
  }
  revealLinesInCenterIfOutsideViewport(
    lineNumber: number,
    endLineNumber: number,
    scrollType?: monaco.editor.ScrollType | undefined,
  ): void {
    this.modifiedEditor.revealLinesInCenterIfOutsideViewport(lineNumber, endLineNumber, scrollType);
  }
  revealRange(range: monaco.IRange, scrollType?: monaco.editor.ScrollType | undefined): void {
    this.modifiedEditor.revealRange(range, scrollType);
  }
  revealRangeInCenter(range: monaco.IRange, scrollType?: monaco.editor.ScrollType | undefined): void {
    this.modifiedEditor.revealRange(range, scrollType);
  }
  revealRangeAtTop(range: monaco.IRange, scrollType?: monaco.editor.ScrollType | undefined): void {
    this.modifiedEditor.revealRange(range, scrollType);
  }
  revealRangeInCenterIfOutsideViewport(range: monaco.IRange, scrollType?: monaco.editor.ScrollType | undefined): void {
    this.modifiedEditor.revealRange(range, scrollType);
  }
  trigger(source: string, handlerId: string, payload: any): void {
    throw new Error('Method not implemented.');
  }
  getOptions() {
    return this.originalEditor.getOptions();
  }
  getOption(key: any) {
    return this.getOption(key);
  }
  getContentWidth() {
    return this.originalEditor.getContentWidth();
  }
  getContainerDomNode() {
    return this.originalEditor.getContainerDomNode();
  }
}

interface IDiffRange {
  rhs: boolean;
  range: Range;
}

export class MockedDiffNavigator implements monaco.editor.IDiffNavigator {
  constructor(public diffEditor, public opts) {}

  canNavigate(): boolean {
    throw new Error('Method not implemented.');
  }

  next(): void {
    throw new Error('Method not implemented.');
  }

  previous(): void {
    throw new Error('Method not implemented.');
  }

  dispose(): void {
    throw new Error('Method not implemented.');
  }

  ranges: IDiffRange[];
  nextIdx: number;
  revealFirst: boolean;

  _initIdx(fwd: boolean): void {
    throw new Error('Method not implemented.');
  }
}

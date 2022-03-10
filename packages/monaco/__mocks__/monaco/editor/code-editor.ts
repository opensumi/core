import { Emitter, Event, Disposable, IDisposable } from '@opensumi/ide-core-common';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

export class MockedCodeEditor extends Disposable implements monaco.editor.ICodeEditor {
  static ID = 0;

  private position: any;
  private selections: any[] = [];
  model: monaco.editor.ITextModel | null;

  id: number;

  constructor(public dom: any, public options: any, public override: any) {
    super();
    this.id = ++MockedCodeEditor.ID;
  }
  onMouseDropCanceled(listener: () => void): monaco.IDisposable {
    throw new Error('Method not implemented.');
  }
  popUndoStop(): boolean {
    throw new Error('Method not implemented.');
  }
  getOverflowWidgetsDomNode(): HTMLElement | undefined {
    throw new Error('Method not implemented.');
  }
  getConfiguredWordAtPosition(position: monaco.Position): monaco.editor.IWordAtPosition | null {
    throw new Error('Method not implemented.');
  }
  _getViewModel() {
    throw new Error('Method not implemented.');
  }
  getVisibleRangesPlusViewportAboveBelow(): monaco.Range[] {
    throw new Error('Method not implemented.');
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
  isSimpleWidget: boolean;
  onWillType(listener: (text: string) => void): monaco.IDisposable {
    throw new Error('Method not implemented.');
  }
  getConfiguration(): any {}
  onDidType(listener: (text: string) => void): monaco.IDisposable {
    throw new Error('Method not implemented.');
  }
  onDidAttemptReadOnlyEdit(listener: () => void): monaco.IDisposable {
    throw new Error('Method not implemented.');
  }
  onMouseDrag(listener: (e: monaco.editor.IEditorMouseEvent) => void): monaco.IDisposable {
    throw new Error('Method not implemented.');
  }
  onMouseDrop(listener: (e: monaco.editor.IPartialEditorMouseEvent) => void): monaco.IDisposable {
    throw new Error('Method not implemented.');
  }
  onMouseWheel(listener: (e: any) => void): monaco.IDisposable {
    throw new Error('Method not implemented.');
  }
  invokeWithinContext<T>(fn: (accessor: any) => T): T {
    throw new Error('Method not implemented.');
  }
  _getCursors() {
    throw new Error('Method not implemented.');
  }
  setDecorations(description: string, decorationTypeKey: string, ranges: monaco.editor.IDecorationOptions[]): void {
    throw new Error('Method not implemented.');
  }
  setDecorationsFast(decorationTypeKey: string, ranges: monaco.IRange[]): void {
    throw new Error('Method not implemented.');
  }
  removeDecorations(decorationTypeKey: string): void {
    throw new Error('Method not implemented.');
  }
  getWhitespaces(): monaco.editor.IEditorWhitespace[] {
    throw new Error('Method not implemented.');
  }
  setHiddenAreas(ranges: monaco.IRange[]): void {
    throw new Error('Method not implemented.');
  }
  setAriaOptions(options: monaco.editor.IEditorAriaOptions): void {
    throw new Error('Method not implemented.');
  }
  getTelemetryData(): { [key: string]: any } | undefined {
    throw new Error('Method not implemented.');
  }
  hasModel(): this is monaco.editor.IActiveCodeEditor {
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
  onDidCompositionStart(listener: () => void): monaco.IDisposable {
    throw new Error('Method not implemented.');
  }
  onDidCompositionEnd(listener: () => void): monaco.IDisposable {
    throw new Error('Method not implemented.');
  }
  onDidPaste(listener: (e: monaco.editor.IPasteEvent) => void): monaco.IDisposable {
    throw new Error('Method not implemented.');
  }
  onDidContentSizeChange(listener: (e: monaco.editor.IContentSizeChangedEvent) => void): monaco.IDisposable {
    throw new Error('Method not implemented.');
  }
  getOptions(): monaco.editor.IComputedEditorOptions {
    throw new Error('Method not implemented.');
  }
  getOption(_: any): any {
    throw new Error('Method not implemented.');
  }
  getContentWidth(): number {
    throw new Error('Method not implemented.');
  }
  getContentHeight(): number {
    throw new Error('Method not implemented.');
  }
  getContainerDomNode(): HTMLElement {
    return this.dom;
  }

  _onDidChangeModelContent = new Emitter<monaco.editor.IModelContentChangedEvent>();
  onDidChangeModelContent: Event<monaco.editor.IModelContentChangedEvent> = this._onDidChangeModelContent.event;

  _onDidChangeModelLanguage = new Emitter<monaco.editor.IModelLanguageChangedEvent>();
  onDidChangeModelLanguage: Event<monaco.editor.IModelLanguageChangedEvent> = this._onDidChangeModelLanguage.event;

  _onDidChangeModelLanguageConfiguration = new Emitter<monaco.editor.IModelLanguageConfigurationChangedEvent>();
  onDidChangeModelLanguageConfiguration: Event<monaco.editor.IModelLanguageConfigurationChangedEvent> =
    this._onDidChangeModelLanguageConfiguration.event;

  _onDidChangeModelOptions = new Emitter<monaco.editor.IModelOptionsChangedEvent>();
  onDidChangeModelOptions = this._onDidChangeModelOptions.event;

  _onDidChangeConfiguration = new Emitter<monaco.editor.ConfigurationChangedEvent>();
  onDidChangeConfiguration = this._onDidChangeConfiguration.event;

  _onDidChangeCursorPosition = new Emitter<monaco.editor.ICursorPositionChangedEvent>();
  onDidChangeCursorPosition = this._onDidChangeCursorPosition.event;

  _onDidChangeCursorSelection = new Emitter<monaco.editor.ICursorSelectionChangedEvent>();
  onDidChangeCursorSelection = this._onDidChangeCursorSelection.event;

  _onDidChangeModel = new Emitter<monaco.editor.IModelChangedEvent>();
  onDidChangeModel = this._onDidChangeModel.event;

  _onDidChangeModelDecorations = new Emitter<monaco.editor.IModelDecorationsChangedEvent>();
  onDidChangeModelDecorations = this._onDidChangeModelDecorations.event;

  _onDidFocusEditorText = new Emitter<void>();
  onDidFocusEditorText = this._onDidFocusEditorText.event;

  _onDidBlurEditorText = new Emitter<void>();
  onDidBlurEditorText = this._onDidBlurEditorText.event;

  _onDidFocusEditorWidget = new Emitter<void>();
  onDidFocusEditorWidget = this._onDidFocusEditorWidget.event;

  _onDidBlurEditorWidget = new Emitter<void>();
  onDidBlurEditorWidget = this._onDidBlurEditorWidget.event;

  _onCompositionStart = new Emitter<void>();
  onCompositionStart = this._onCompositionStart.event;

  _onCompositionEnd = new Emitter<void>();
  onCompositionEnd = this._onCompositionEnd.event;

  _onMouseUp = new Emitter<monaco.editor.IEditorMouseEvent>();
  onMouseUp = this._onMouseUp.event;

  _onMouseDown = new Emitter<monaco.editor.IEditorMouseEvent>();
  onMouseDown = this._onMouseDown.event;

  _onContextMenu = new Emitter<monaco.editor.IEditorMouseEvent>();
  onContextMenu = this._onContextMenu.event;

  _onMouseMove = new Emitter<monaco.editor.IEditorMouseEvent>();
  onMouseMove = this._onMouseMove.event;

  _onMouseLeave = new Emitter<monaco.editor.IPartialEditorMouseEvent>();
  onMouseLeave = this._onMouseLeave.event;

  _onKeyUp = new Emitter<monaco.IKeyboardEvent>();
  onKeyUp = this._onKeyUp.event;

  _onKeyDown = new Emitter<monaco.IKeyboardEvent>();
  onKeyDown = this._onKeyDown.event;

  _onDidLayoutChange = new Emitter<monaco.editor.EditorLayoutInfo>();
  onDidLayoutChange = this._onDidLayoutChange.event;

  _onDidScrollChange = new Emitter<monaco.IScrollEvent>();
  onDidScrollChange = this._onDidScrollChange.event;

  saveViewState(): monaco.editor.ICodeEditorViewState | null {
    return null;
  }
  restoreViewState(state: monaco.editor.ICodeEditorViewState): void {
    return;
  }
  hasWidgetFocus(): boolean {
    return false;
  }
  getContribution<T extends monaco.editor.IEditorContribution>(id: string): T {
    return null as any;
  }
  getModel(): monaco.editor.ITextModel | null {
    return this.model;
  }
  setModel(model: monaco.editor.ITextModel | null): void {
    this.model = model;
  }
  getRawOptions(): monaco.editor.IEditorOptions {
    return {
      renderLineHighlight: 'line',
      renderLineNumbers: 1,
    } as any;
  }
  getValue(options?: { preserveBOM: boolean; lineEnding: string } | undefined): string {
    return this.model?.getValue() || '';
  }
  setValue(newValue: string): void {
    return;
  }
  getScrollWidth(): number {
    return 0;
  }
  getScrollLeft(): number {
    return 0;
  }
  getScrollHeight(): number {
    return 0;
  }
  getScrollTop(): number {
    return 0;
  }
  setScrollLeft(newScrollLeft: number): void {
    return;
  }
  setScrollTop(newScrollTop: number): void {
    return;
  }
  setScrollPosition(position: monaco.editor.INewScrollPosition): void {
    return;
  }
  getAction(id: string): monaco.editor.IEditorAction {
    return null as any;
  }
  executeCommand(source: string, command: monaco.editor.ICommand): void {
    return;
  }
  pushUndoStop(): boolean {
    return true;
  }
  executeEdits(
    source: string,
    edits: monaco.editor.IIdentifiedSingleEditOperation[],
    endCursorState?: monaco.Selection[] | undefined,
  ): boolean {
    switch (source) {
      case 'MainThreadTextEditor':
        this.model?.applyEdits(edits);
        break;
      default:
        break;
    }
    return true;
  }
  executeCommands(source: string, commands: (monaco.editor.ICommand | null)[]): void {
    return;
  }
  getLineDecorations(lineNumber: number): monaco.editor.IModelDecoration[] | null {
    return null;
  }
  deltaDecorations = jest.fn((oldDecorations: string[], newDecorations: monaco.editor.IModelDeltaDecoration[]) => []);

  getLayoutInfo(): monaco.editor.EditorLayoutInfo {
    return {
      isViewportWrapping: false,
      isWordWrapMinified: false,
      wrappingColumn: 1,
      height: 0,
      width: 0,
      glyphMarginLeft: 0,
      glyphMarginWidth: 0,
      contentLeft: 0,
      contentWidth: 0,
      lineNumbersLeft: 0,
      lineNumbersWidth: 0,
      decorationsLeft: 0,
      decorationsWidth: 0,
      minimap: {
        minimapLeft: 0,
        minimapWidth: 0,
        renderMinimap: 1,
        minimapCanvasInnerHeight: 0,
        minimapCanvasOuterHeight: 0,
        minimapCanvasInnerWidth: 0,
        minimapCanvasOuterWidth: 0,
        minimapHeightIsEditorHeight: true,
        minimapIsSampling: true,
        minimapLineHeight: 0,
        minimapScale: 0,
      },
      verticalScrollbarWidth: 0,
      viewportColumn: 0,
      horizontalScrollbarHeight: 0,
      overviewRuler: {
        width: 0,
        height: 0,
        top: 0,
        right: 0,
      },
    };
  }
  getVisibleRanges(): monaco.Range[] {
    return [new monaco.Range(1, 12, 1, 12)];
  }
  getTopForLineNumber(lineNumber: number): number {
    return 0;
  }
  getTopForPosition(lineNumber: number, column: number): number {
    return 0;
  }
  getDomNode(): HTMLElement | null {
    return this.dom;
  }
  addContentWidget(widget: monaco.editor.IContentWidget): void {
    return;
  }
  layoutContentWidget(widget: monaco.editor.IContentWidget): void {
    return;
  }
  removeContentWidget(widget: monaco.editor.IContentWidget): void {
    return;
  }
  addOverlayWidget(widget: monaco.editor.IOverlayWidget): void {
    return;
  }
  layoutOverlayWidget(widget: monaco.editor.IOverlayWidget): void {
    return;
  }
  removeOverlayWidget(widget: monaco.editor.IOverlayWidget): void {
    return;
  }
  changeViewZones(callback: (accessor: monaco.editor.IViewZoneChangeAccessor) => void): void {
    return;
  }
  getOffsetForColumn(lineNumber: number, column: number): number {
    return 0;
  }
  render(forceRedraw?: boolean | undefined): void {
    return;
  }
  getTargetAtClientPoint(clientX: number, clientY: number): monaco.editor.IMouseTarget | null {
    return null;
  }
  getScrolledVisiblePosition(position: monaco.IPosition): { top: number; left: number; height: number } | null {
    return null;
  }
  applyFontInfo(target: HTMLElement): void {
    return;
  }

  _onDidDispose = new Emitter<void>();
  onDidDispose = this._onDidDispose.event;

  getId(): string {
    return this.getEditorType() + ':' + this.id;
  }

  getEditorType(): string {
    return 'vs.editor.ICodeEditor';
    // return 'vs.editor.IDiffEditor;
  }

  updateOptions = jest.fn((newOptions) => {
    this.options = newOptions;
    // FIXME LATER
    // this._onDidChangeConfiguration.fire(newOptions as monaco.editor.IConfigurationChangedEvent);
  });
  layout(dimension?: monaco.editor.IDimension | undefined): void {
    return;
  }

  focus = jest.fn(() => {
    this._onDidFocusEditorText.fire();
  });

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
    return this.position;
  }
  setPosition(position: monaco.IPosition): void {
    this.position = position;
  }
  revealLine(lineNumber: number, scrollType?: monaco.editor.ScrollType | undefined): void {
    return;
  }
  revealLineInCenter(lineNumber: number, scrollType?: monaco.editor.ScrollType | undefined): void {
    return;
  }
  revealLineInCenterIfOutsideViewport(lineNumber: number, scrollType?: monaco.editor.ScrollType | undefined): void {
    return;
  }
  revealPosition(position: monaco.IPosition, scrollType?: monaco.editor.ScrollType | undefined): void {
    return;
  }
  revealPositionInCenter(position: monaco.IPosition, scrollType?: monaco.editor.ScrollType | undefined): void {
    return;
  }
  revealPositionInCenterIfOutsideViewport(
    position: monaco.IPosition,
    scrollType?: monaco.editor.ScrollType | undefined,
  ): void {
    return;
  }
  getSelection = jest.fn(() => this.selections[0]);

  getSelections = jest.fn(() => this.selections);

  setSelection = jest.fn((selection: any) => {
    this.selections = [selection];
    this._onDidChangeCursorSelection.fire({
      selection,
      secondarySelections: [],
      reason: 0,
      source: 'api',
      modelVersionId: 1,
      oldSelections: [],
      oldModelVersionId: 0,
    });
  });
  setSelections = jest.fn((selections: monaco.ISelection[]) => {
    this.selections = selections;
  });

  revealLines(startLineNumber: number, endLineNumber: number, scrollType?: monaco.editor.ScrollType | undefined): void {
    return;
  }
  revealLinesInCenter(
    lineNumber: number,
    endLineNumber: number,
    scrollType?: monaco.editor.ScrollType | undefined,
  ): void {
    return;
  }
  revealLinesInCenterIfOutsideViewport(
    lineNumber: number,
    endLineNumber: number,
    scrollType?: monaco.editor.ScrollType | undefined,
  ): void {
    return;
  }
  revealRange(range: monaco.IRange, scrollType?: monaco.editor.ScrollType | undefined): void {
    return;
  }
  revealRangeInCenter(range: monaco.IRange, scrollType?: monaco.editor.ScrollType | undefined): void {
    return;
  }
  revealRangeAtTop(range: monaco.IRange, scrollType?: monaco.editor.ScrollType | undefined): void {
    return;
  }
  revealRangeInCenterIfOutsideViewport(range: monaco.IRange, scrollType?: monaco.editor.ScrollType | undefined): void {
    return;
  }
  trigger(source: string, handlerId: string, payload: any): void {
    return;
  }
}

export class MockedStandaloneCodeEditor extends MockedCodeEditor {
  constructor(public dom, public options, public override) {
    super(dom, options, override);
  }

  addCommand(keybinding: number, handler: monaco.editor.ICommandHandler, context?: string | undefined): string | null {
    throw new Error('Method not implemented.');
  }

  createContextKey<T>(key: string, defaultValue: T): monaco.editor.IContextKey<T> {
    throw new Error('Method not implemented.');
  }
  addAction(descriptor: monaco.editor.IActionDescriptor): monaco.IDisposable {
    throw new Error('Method not implemented.');
  }
  setDecorations(description: string, decorationTypeKey: string, ranges: monaco.editor.IDecorationOptions[]): void {
    throw new Error('Method not implemented.');
  }
  setDecorationsFast(decorationTypeKey: string, ranges: monaco.IRange[]): void {
    throw new Error('Method not implemented.');
  }
  revealLineInCenter(line: number) {}
  setPosition(position: monaco.Position) {}
  onDidCompositionStart(): IDisposable {
    return new Disposable();
  }
  onDidCompositionEnd(): IDisposable {
    return new Disposable();
  }
  onDidPaste(): IDisposable {
    return new Disposable();
  }
  onDidContentSizeChange(): IDisposable {
    return new Disposable();
  }
}

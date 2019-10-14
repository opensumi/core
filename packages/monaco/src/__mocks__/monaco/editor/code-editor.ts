import { Emitter, Disposable } from '@ali/ide-core-common';

export class MockedCodeEditor extends Disposable implements monaco.editor.ICodeEditor {

  private position: any;
  private selections: any[];
  model: monaco.editor.ITextModel | null;

  constructor(public dom, public options, public override) {
    super();
  }

  _onDidChangeModelContent = new Emitter<monaco.editor.IModelContentChangedEvent>();
  onDidChangeModelContent = this._onDidChangeModelContent.event;

  _onDidChangeModelLanguage = new Emitter<monaco.editor.IModelLanguageChangedEvent>();
  onDidChangeModelLanguage = this._onDidChangeModelLanguage.event;

  _onDidChangeModelLanguageConfiguration = new Emitter<monaco.editor.IModelLanguageConfigurationChangedEvent>();
  onDidChangeModelLanguageConfiguration = this._onDidChangeModelLanguageConfiguration.event;

  _onDidChangeModelOptions = new Emitter<monaco.editor.IModelOptionsChangedEvent>();
  onDidChangeModelOptions = this._onDidChangeModelOptions.event;

  _onDidChangeConfiguration = new Emitter<monaco.editor.IConfigurationChangedEvent>();
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
  getConfiguration(): monaco.editor.InternalEditorOptions {
    return {} as any;
  }
  getValue(options?: { preserveBOM: boolean; lineEnding: string; } | undefined): string {
    return '';
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
  executeEdits(source: string, edits: monaco.editor.IIdentifiedSingleEditOperation[], endCursorState?: monaco.Selection[] | undefined): boolean {
    return true;
  }
  executeCommands(source: string, commands: (monaco.editor.ICommand | null)[]): void {
    return;
  }
  getLineDecorations(lineNumber: number): monaco.editor.IModelDecoration[] | null {
    return null;
  }
  deltaDecorations(oldDecorations: string[], newDecorations: monaco.editor.IModelDeltaDecoration[]): string[] {
    return [];
  }
  getLayoutInfo(): monaco.editor.EditorLayoutInfo {
    return {
      height: 0,
      width: 0,
      glyphMarginHeight: 0,
      glyphMarginLeft: 0,
      glyphMarginWidth: 0,
      contentHeight: 0,
      contentLeft: 0,
      contentWidth: 0,
      lineNumbersHeight: 0,
      lineNumbersLeft: 0,
      lineNumbersWidth: 0,
      decorationsLeft: 0,
      decorationsHeight: 0,
      decorationsWidth: 0,
      minimapLeft: 0,
      minimapWidth: 0,
      renderMinimap: 0,
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
    return [];
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
  getScrolledVisiblePosition(position: monaco.IPosition): { top: number; left: number; height: number; } | null {
    return null;
  }
  applyFontInfo(target: HTMLElement): void {
    return;
  }

  _commandService: monaco.commands.ICommandService;

  cursor: monaco.editor.ICursor;

  _onDidDispose = new Emitter<void>();
  onDidDispose = this._onDidDispose.event;

  getId(): string {
    throw new Error('Method not implemented.');
  }
  getEditorType(): string {
    throw new Error('Method not implemented.');
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
  revealPositionInCenterIfOutsideViewport(position: monaco.IPosition, scrollType?: monaco.editor.ScrollType | undefined): void {
    return;
  }
  getSelection(): monaco.Selection | null {
    return this.selections[0];
  }
  getSelections(): monaco.Selection[] | null {
    return this.selections;
  }

  setSelection(selection: any) {
    this.selections = [selection];
  }
  setSelections(selections: monaco.ISelection[]): void {
    this.selections = selections;
  }
  revealLines(startLineNumber: number, endLineNumber: number, scrollType?: monaco.editor.ScrollType | undefined): void {
    return;
  }
  revealLinesInCenter(lineNumber: number, endLineNumber: number, scrollType?: monaco.editor.ScrollType | undefined): void {
    return;
  }
  revealLinesInCenterIfOutsideViewport(lineNumber: number, endLineNumber: number, scrollType?: monaco.editor.ScrollType | undefined): void {
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

export class MockedStandaloneCodeEditor extends MockedCodeEditor implements monaco.editor.IStandaloneCodeEditor {

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
  setDecorations(decorationTypeKey: string, ranges: monaco.editor.IDecorationOptions[]): void {
    throw new Error('Method not implemented.');
  }
  setDecorationsFast(decorationTypeKey: string, ranges: monaco.IRange[]): void {
    throw new Error('Method not implemented.');
  }

  _instantiationService: monaco.instantiation.IInstantiationService;

  _contributions: { 'editor.controller.quickOpenController': monaco.quickOpen.QuickOpenController; 'editor.contrib.referencesController': monaco.referenceSearch.ReferencesController; };

}

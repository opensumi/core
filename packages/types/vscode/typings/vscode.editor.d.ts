declare module 'vscode' {
  /**
	 * Represents sources that can cause [selection change events](#window.onDidChangeTextEditorSelection).
	*/
	export enum TextEditorSelectionChangeKind {
		/**
		 * Selection changed due to typing in the editor.
		 */
		Keyboard = 1,
		/**
		 * Selection change due to clicking in the editor.
		 */
		Mouse = 2,
		/**
		 * Selection changed because a command ran.
		 */
		Command = 3
  }

  /**
	 * Represents an event describing the change in a [text editor's selections](#TextEditor.selections).
	 */
	export interface TextEditorSelectionChangeEvent {
		/**
		 * The [text editor](#TextEditor) for which the selections have changed.
		 */
		readonly textEditor: TextEditor;
		/**
		 * The new value for the [text editor's selections](#TextEditor.selections).
		 */
		readonly selections: ReadonlyArray<Selection>;
		/**
		 * The [change kind](#TextEditorSelectionChangeKind) which has triggered this
		 * event. Can be `undefined`.
		 */
		readonly kind?: TextEditorSelectionChangeKind;
	}

	/**
	 * Represents an event describing the change in a [text editor's visible ranges](#TextEditor.visibleRanges).
	 */
	export interface TextEditorVisibleRangesChangeEvent {
		/**
		 * The [text editor](#TextEditor) for which the visible ranges have changed.
		 */
		readonly textEditor: TextEditor;
		/**
		 * The new value for the [text editor's visible ranges](#TextEditor.visibleRanges).
		 */
		readonly visibleRanges: ReadonlyArray<Range>;
	}

	/**
	 * Represents an event describing the change in a [text editor's options](#TextEditor.options).
	 */
	export interface TextEditorOptionsChangeEvent {
		/**
		 * The [text editor](#TextEditor) for which the options have changed.
		 */
		readonly textEditor: TextEditor;
		/**
		 * The new value for the [text editor's options](#TextEditor.options).
		 */
		readonly options: TextEditorOptions;
	}

	/**
	 * Represents an event describing the change of a [text editor's view column](#TextEditor.viewColumn).
	 */
	export interface TextEditorViewColumnChangeEvent {
		/**
		 * The [text editor](#TextEditor) for which the view column has changed.
		 */
		readonly textEditor: TextEditor;
		/**
		 * The new value for the [text editor's view column](#TextEditor.viewColumn).
		 */
		readonly viewColumn: ViewColumn;
	}

	/**
	 * Rendering style of the cursor.
	 */
	export enum TextEditorCursorStyle {
		/**
		 * Render the cursor as a vertical thick line.
		 */
		Line = 1,
		/**
		 * Render the cursor as a block filled.
		 */
		Block = 2,
		/**
		 * Render the cursor as a thick horizontal line.
		 */
		Underline = 3,
		/**
		 * Render the cursor as a vertical thin line.
		 */
		LineThin = 4,
		/**
		 * Render the cursor as a block outlined.
		 */
		BlockOutline = 5,
		/**
		 * Render the cursor as a thin horizontal line.
		 */
		UnderlineThin = 6
	}

	/**
	 * Rendering style of the line numbers.
	 */
	export enum TextEditorLineNumbersStyle {
		/**
		 * Do not render the line numbers.
		 */
		Off = 0,
		/**
		 * Render the line numbers.
		 */
		On = 1,
		/**
		 * Render the line numbers with values relative to the primary cursor location.
		 */
		Relative = 2
	}

	/**
	 * Represents a [text editor](#TextEditor)'s [options](#TextEditor.options).
	 */
	export interface TextEditorOptions {

		/**
		 * The size in spaces a tab takes. This is used for two purposes:
		 *  - the rendering width of a tab character;
		 *  - the number of spaces to insert when [insertSpaces](#TextEditorOptions.insertSpaces) is true.
		 *
		 * When getting a text editor's options, this property will always be a number (resolved).
		 * When setting a text editor's options, this property is optional and it can be a number or `"auto"`.
		 */
		tabSize?: number | string;

		/**
		 * When pressing Tab insert [n](#TextEditorOptions.tabSize) spaces.
		 * When getting a text editor's options, this property will always be a boolean (resolved).
		 * When setting a text editor's options, this property is optional and it can be a boolean or `"auto"`.
		 */
		insertSpaces?: boolean | string;

		/**
		 * The rendering style of the cursor in this editor.
		 * When getting a text editor's options, this property will always be present.
		 * When setting a text editor's options, this property is optional.
		 */
		cursorStyle?: TextEditorCursorStyle;

		/**
		 * Render relative line numbers w.r.t. the current line number.
		 * When getting a text editor's options, this property will always be present.
		 * When setting a text editor's options, this property is optional.
		 */
		lineNumbers?: TextEditorLineNumbersStyle;
	}

	/**
	 * Represents a handle to a set of decorations
	 * sharing the same [styling options](#DecorationRenderOptions) in a [text editor](#TextEditor).
	 *
	 * To get an instance of a `TextEditorDecorationType` use
	 * [createTextEditorDecorationType](#window.createTextEditorDecorationType).
	 */
	export interface TextEditorDecorationType {

		/**
		 * Internal representation of the handle.
		 */
		readonly key: string;

		/**
		 * Remove this decoration type and all decorations on all text editors using it.
		 */
		dispose(): void;
	}

	/**
	 * Represents different [reveal](#TextEditor.revealRange) strategies in a text editor.
	 */
	export enum TextEditorRevealType {
		/**
		 * The range will be revealed with as little scrolling as possible.
		 */
		Default = 0,
		/**
		 * The range will always be revealed in the center of the viewport.
		 */
		InCenter = 1,
		/**
		 * If the range is outside the viewport, it will be revealed in the center of the viewport.
		 * Otherwise, it will be revealed with as little scrolling as possible.
		 */
		InCenterIfOutsideViewport = 2,
		/**
		 * The range will always be revealed at the top of the viewport.
		 */
		AtTop = 3
	}

  /**
	 * Represents different positions for rendering a decoration in an [overview ruler](#DecorationRenderOptions.overviewRulerLane).
	 * The overview ruler supports three lanes.
	 */
	export enum OverviewRulerLane {
		Left = 1,
		Center = 2,
		Right = 4,
		Full = 7
	}

	/**
	 * Describes the behavior of decorations when typing/editing at their edges.
	 */
	export enum DecorationRangeBehavior {
		/**
		 * The decoration's range will widen when edits occur at the start or end.
		 */
		OpenOpen = 0,
		/**
		 * The decoration's range will not widen when edits occur at the start of end.
		 */
		ClosedClosed = 1,
		/**
		 * The decoration's range will widen when edits occur at the start, but not at the end.
		 */
		OpenClosed = 2,
		/**
		 * The decoration's range will widen when edits occur at the end, but not at the start.
		 */
		ClosedOpen = 3
	}

	/**
	 * Represents options to configure the behavior of showing a [document](#TextDocument) in an [editor](#TextEditor).
	 */
	export interface TextDocumentShowOptions {
		/**
		 * An optional view column in which the [editor](#TextEditor) should be shown.
		 * The default is the [active](#ViewColumn.Active), other values are adjusted to
		 * be `Min(column, columnCount + 1)`, the [active](#ViewColumn.Active)-column is
		 * not adjusted. Use [`ViewColumn.Beside`](#ViewColumn.Beside) to open the
		 * editor to the side of the currently active one.
		 */
		viewColumn?: ViewColumn;

		/**
		 * An optional flag that when `true` will stop the [editor](#TextEditor) from taking focus.
		 */
		preserveFocus?: boolean;

		/**
		 * An optional flag that controls if an [editor](#TextEditor)-tab will be replaced
		 * with the next editor or if it will be kept.
		 */
		preview?: boolean;

		/**
		 * An optional selection to apply for the document in the [editor](#TextEditor).
		 */
		selection?: Range;
  }

  /**
	 * Represents rendering styles for a [text editor decoration](#TextEditorDecorationType).
	 */
	export interface DecorationRenderOptions extends ThemableDecorationRenderOptions {
		/**
		 * Should the decoration be rendered also on the whitespace after the line text.
		 * Defaults to `false`.
		 */
		isWholeLine?: boolean;

		/**
		 * Customize the growing behavior of the decoration when edits occur at the edges of the decoration's range.
		 * Defaults to `DecorationRangeBehavior.OpenOpen`.
		 */
		rangeBehavior?: DecorationRangeBehavior;

		/**
		 * The position in the overview ruler where the decoration should be rendered.
		 */
		overviewRulerLane?: OverviewRulerLane;

		/**
		 * Overwrite options for light themes.
		 */
		light?: ThemableDecorationRenderOptions;

		/**
		 * Overwrite options for dark themes.
		 */
		dark?: ThemableDecorationRenderOptions;
	}

	/**
	 * Represents options for a specific decoration in a [decoration set](#TextEditorDecorationType).
	 */
	export interface DecorationOptions {

		/**
		 * Range to which this decoration is applied. The range must not be empty.
		 */
		range: Range;

		/**
		 * A message that should be rendered when hovering over the decoration.
		 */
		hoverMessage?: MarkedString | MarkedString[];

		/**
		 * Render options applied to the current decoration. For performance reasons, keep the
		 * number of decoration specific options small, and use decoration types wherever possible.
		 */
		renderOptions?: DecorationInstanceRenderOptions;
	}

	export interface ThemableDecorationInstanceRenderOptions {
		/**
		 * Defines the rendering options of the attachment that is inserted before the decorated text.
		 */
		before?: ThemableDecorationAttachmentRenderOptions;

		/**
		 * Defines the rendering options of the attachment that is inserted after the decorated text.
		 */
		after?: ThemableDecorationAttachmentRenderOptions;
	}

	export interface DecorationInstanceRenderOptions extends ThemableDecorationInstanceRenderOptions {
		/**
		 * Overwrite options for light themes.
		 */
		light?: ThemableDecorationInstanceRenderOptions;

		/**
		 * Overwrite options for dark themes.
		 */
		dark?: ThemableDecorationInstanceRenderOptions;
	}

	/**
	 * Represents an editor that is attached to a [document](#TextDocument).
	 */
	export interface TextEditor {

		/**
		 * The document associated with this text editor. The document will be the same for the entire lifetime of this text editor.
		 */
		readonly document: TextDocument;

		/**
		 * The primary selection on this text editor. Shorthand for `TextEditor.selections[0]`.
		 */
		selection: Selection;

		/**
		 * The selections in this text editor. The primary selection is always at index 0.
		 */
		selections: Selection[];

		/**
		 * The current visible ranges in the editor (vertically).
		 * This accounts only for vertical scrolling, and not for horizontal scrolling.
		 */
		readonly visibleRanges: Range[];

		/**
		 * Text editor options.
		 */
		options: TextEditorOptions;

		/**
		 * The column in which this editor shows. Will be `undefined` in case this
		 * isn't one of the main editors, e.g. an embedded editor, or when the editor
		 * column is larger than three.
		 */
		viewColumn?: ViewColumn;

		/**
		 * Perform an edit on the document associated with this text editor.
		 *
		 * The given callback-function is invoked with an [edit-builder](#TextEditorEdit) which must
		 * be used to make edits. Note that the edit-builder is only valid while the
		 * callback executes.
		 *
		 * @param callback A function which can create edits using an [edit-builder](#TextEditorEdit).
		 * @param options The undo/redo behavior around this edit. By default, undo stops will be created before and after this edit.
		 * @return A promise that resolves with a value indicating if the edits could be applied.
		 */
		edit(callback: (editBuilder: TextEditorEdit) => void, options?: { undoStopBefore: boolean; undoStopAfter: boolean; }): Thenable<boolean>;

		/**
		 * Insert a [snippet](#SnippetString) and put the editor into snippet mode. "Snippet mode"
		 * means the editor adds placeholders and additional cursors so that the user can complete
		 * or accept the snippet.
		 *
		 * @param snippet The snippet to insert in this edit.
		 * @param location Position or range at which to insert the snippet, defaults to the current editor selection or selections.
		 * @param options The undo/redo behavior around this edit. By default, undo stops will be created before and after this edit.
		 * @return A promise that resolves with a value indicating if the snippet could be inserted. Note that the promise does not signal
		 * that the snippet is completely filled-in or accepted.
		 */
		insertSnippet(snippet: SnippetString, location?: Position | Range | ReadonlyArray<Position> | ReadonlyArray<Range>, options?: { undoStopBefore: boolean; undoStopAfter: boolean; }): Thenable<boolean>;

		/**
		 * Adds a set of decorations to the text editor. If a set of decorations already exists with
		 * the given [decoration type](#TextEditorDecorationType), they will be replaced.
		 *
		 * @see [createTextEditorDecorationType](#window.createTextEditorDecorationType).
		 *
		 * @param decorationType A decoration type.
		 * @param rangesOrOptions Either [ranges](#Range) or more detailed [options](#DecorationOptions).
		 */
		setDecorations(decorationType: TextEditorDecorationType, rangesOrOptions: Range[] | DecorationOptions[]): void;

		/**
		 * Scroll as indicated by `revealType` in order to reveal the given range.
		 *
		 * @param range A range.
		 * @param revealType The scrolling strategy for revealing `range`.
		 */
		revealRange(range: Range, revealType?: TextEditorRevealType): void;

		/**
		 * ~~Show the text editor.~~
		 *
		 * @deprecated Use [window.showTextDocument](#window.showTextDocument) instead.
		 *
		 * @param column The [column](#ViewColumn) in which to show this editor.
		 * This method shows unexpected behavior and will be removed in the next major update.
		 */
		show(column?: ViewColumn): void;

		/**
		 * ~~Hide the text editor.~~
		 *
		 * @deprecated Use the command `workbench.action.closeActiveEditor` instead.
		 * This method shows unexpected behavior and will be removed in the next major update.
		 */
		hide(): void;
  }

  export interface TextEditorEdit {
		/**
		 * Replace a certain text region with a new value.
		 * You can use \r\n or \n in `value` and they will be normalized to the current [document](#TextDocument).
		 *
		 * @param location The range this operation should remove.
		 * @param value The new text this operation should insert after removing `location`.
		 */
		replace(location: Position | Range | Selection, value: string): void;

		/**
		 * Insert text at a location.
		 * You can use \r\n or \n in `value` and they will be normalized to the current [document](#TextDocument).
		 * Although the equivalent text edit can be made with [replace](#TextEditorEdit.replace), `insert` will produce a different resulting selection (it will get moved).
		 *
		 * @param location The position where the new text should be inserted.
		 * @param value The new text this operation should insert.
		 */
		insert(location: Position, value: string): void;

		/**
		 * Delete a certain text region.
		 *
		 * @param location The range this operation should remove.
		 */
		delete(location: Range | Selection): void;

		/**
		 * Set the end of line sequence.
		 *
		 * @param endOfLine The new end of line for the [document](#TextDocument).
		 */
		setEndOfLine(endOfLine: EndOfLine): void;
  }

  	/**
	 * Denotes a location of an editor in the window. Editors can be arranged in a grid
	 * and each column represents one editor location in that grid by counting the editors
	 * in order of their appearance.
	 */
	export enum ViewColumn {
		/**
		 * A *symbolic* editor column representing the currently active column. This value
		 * can be used when opening editors, but the *resolved* [viewColumn](#TextEditor.viewColumn)-value
		 * of editors will always be `One`, `Two`, `Three`,... or `undefined` but never `Active`.
		 */
		Active = -1,
		/**
		 * A *symbolic* editor column representing the column to the side of the active one. This value
		 * can be used when opening editors, but the *resolved* [viewColumn](#TextEditor.viewColumn)-value
		 * of editors will always be `One`, `Two`, `Three`,... or `undefined` but never `Beside`.
		 */
		Beside = -2,
		/**
		 * The first editor column.
		 */
		One = 1,
		/**
		 * The second editor column.
		 */
		Two = 2,
		/**
		 * The third editor column.
		 */
		Three = 3,
		/**
		 * The fourth editor column.
		 */
		Four = 4,
		/**
		 * The fifth editor column.
		 */
		Five = 5,
		/**
		 * The sixth editor column.
		 */
		Six = 6,
		/**
		 * The seventh editor column.
		 */
		Seven = 7,
		/**
		 * The eighth editor column.
		 */
		Eight = 8,
		/**
		 * The ninth editor column.
		 */
		Nine = 9
	}


  export namespace window {

    /**
		 * The currently active editor or `undefined`. The active editor is the one
		 * that currently has focus or, when none has focus, the one that has changed
		 * input most recently.
		 */
		export let activeTextEditor: TextEditor | undefined;

		/**
		 * The currently visible editors or an empty array.
		 */
    export let visibleTextEditors: TextEditor[];

    /**
		 * An [event](#Event) which fires when the [active editor](#window.activeTextEditor)
		 * has changed. *Note* that the event also fires when the active editor changes
		 * to `undefined`.
		 */
		export const onDidChangeActiveTextEditor: Event<TextEditor | undefined>;

		/**
		 * An [event](#Event) which fires when the array of [visible editors](#window.visibleTextEditors)
		 * has changed.
		 */
		export const onDidChangeVisibleTextEditors: Event<TextEditor[]>;

		/**
		 * An [event](#Event) which fires when the selection in an editor has changed.
		 */
		export const onDidChangeTextEditorSelection: Event<TextEditorSelectionChangeEvent>;

		/**
		 * An [event](#Event) which fires when the visible ranges of an editor has changed.
		 */
		export const onDidChangeTextEditorVisibleRanges: Event<TextEditorVisibleRangesChangeEvent>;

		/**
		 * An [event](#Event) which fires when the options of an editor have changed.
		 */
		export const onDidChangeTextEditorOptions: Event<TextEditorOptionsChangeEvent>;

		/**
		 * An [event](#Event) which fires when the view column of an editor has changed.
		 */
		export const onDidChangeTextEditorViewColumn: Event<TextEditorViewColumnChangeEvent>;


    /**
		 * Show the given document in a text editor. A [column](#ViewColumn) can be provided
		 * to control where the editor is being shown. Might change the [active editor](#window.activeTextEditor).
		 *
		 * @param document A text document to be shown.
		 * @param column A view column in which the [editor](#TextEditor) should be shown. The default is the [active](#ViewColumn.Active), other values
		 * are adjusted to be `Min(column, columnCount + 1)`, the [active](#ViewColumn.Active)-column is not adjusted. Use [`ViewColumn.Beside`](#ViewColumn.Beside)
		 * to open the editor to the side of the currently active one.
		 * @param preserveFocus When `true` the editor will not take focus.
		 * @return A promise that resolves to an [editor](#TextEditor).
		 */
		export function showTextDocument(document: TextDocument, column?: ViewColumn, preserveFocus?: boolean): Thenable<TextEditor>;

		/**
		 * Show the given document in a text editor. [Options](#TextDocumentShowOptions) can be provided
		 * to control options of the editor is being shown. Might change the [active editor](#window.activeTextEditor).
		 *
		 * @param document A text document to be shown.
		 * @param options [Editor options](#TextDocumentShowOptions) to configure the behavior of showing the [editor](#TextEditor).
		 * @return A promise that resolves to an [editor](#TextEditor).
		 */
		export function showTextDocument(document: TextDocument, options?: TextDocumentShowOptions): Thenable<TextEditor>;

		/**
		 * A short-hand for `openTextDocument(uri).then(document => showTextDocument(document, options))`.
		 *
		 * @see [openTextDocument](#openTextDocument)
		 *
		 * @param uri A resource identifier.
		 * @param options [Editor options](#TextDocumentShowOptions) to configure the behavior of showing the [editor](#TextEditor).
		 * @return A promise that resolves to an [editor](#TextEditor).
		 */
		export function showTextDocument(uri: Uri, options?: TextDocumentShowOptions): Thenable<TextEditor>;

		/**
		 * Create a TextEditorDecorationType that can be used to add decorations to text editors.
		 *
		 * @param options Rendering options for the decoration type.
		 * @return A new decoration type instance.
		 */
		export function createTextEditorDecorationType(options: DecorationRenderOptions): TextEditorDecorationType;

	}

	export class TextEdit {

		/**
		 * Utility to create a replace edit.
		 *
		 * @param range A range.
		 * @param newText A string.
		 * @return A new text edit object.
		 */
		static replace(range: Range, newText: string): TextEdit;

		/**
		 * Utility to create an insert edit.
		 *
		 * @param position A position, will become an empty range.
		 * @param newText A string.
		 * @return A new text edit object.
		 */
		static insert(position: Position, newText: string): TextEdit;

		/**
		 * Utility to create a delete edit.
		 *
		 * @param range A range.
		 * @return A new text edit object.
		 */
		static delete(range: Range): TextEdit;

		/**
		 * Utility to create an eol-edit.
		 *
		 * @param eol An eol-sequence
		 * @return A new text edit object.
		 */
		static setEndOfLine(eol: EndOfLine): TextEdit;

		/**
		 * The range this edit applies to.
		 */
		range: Range;

		/**
		 * The string this edit will insert.
		 */
		newText: string;

		/**
		 * The eol-sequence used in the document.
		 *
		 * *Note* that the eol-sequence will be applied to the
		 * whole document.
		 */
		newEol: EndOfLine;

		/**
		 * Create a new TextEdit.
		 *
		 * @param range A range.
		 * @param newText A string.
		 */
		constructor(range: Range, newText: string);
  }

    /**
   * Provider for text based custom editors.
   *
   * Text based custom editors use a [`TextDocument`](#TextDocument) as their data model. This considerably simplifies
   * implementing a custom editor as it allows VS Code to handle many common operations such as
   * undo and backup. The provider is responsible for synchronizing text changes between the webview and the `TextDocument`.
   */
  export interface CustomTextEditorProvider {

    /**
     * Resolve a custom editor for a given text resource.
     *
     * This is called when a user first opens a resource for a `CustomTextEditorProvider`, or if they reopen an
     * existing editor using this `CustomTextEditorProvider`.
     *
     *
     * @param document Document for the resource to resolve.
     *
     * @param webviewPanel The webview panel used to display the editor UI for this resource.
     *
     * During resolve, the provider must fill in the initial html for the content webview panel and hook up all
     * the event listeners on it that it is interested in. The provider can also hold onto the `WebviewPanel` to
     * use later for example in a command. See [`WebviewPanel`](#WebviewPanel) for additional details.
     *
     * @param token A cancellation token that indicates the result is no longer needed.
     *
     * @return Thenable indicating that the custom editor has been resolved.
     */
    resolveCustomTextEditor(document: TextDocument, webviewPanel: WebviewPanel, token: CancellationToken): Thenable<void> | void;
  }

  /**
   * Represents a custom document used by a [`CustomEditorProvider`](#CustomEditorProvider).
   *
   * Custom documents are only used within a given `CustomEditorProvider`. The lifecycle of a `CustomDocument` is
   * managed by VS Code. When no more references remain to a `CustomDocument`, it is disposed of.
   */
  interface CustomDocument {
    /**
     * The associated uri for this document.
     */
    readonly uri: Uri;

    /**
     * Dispose of the custom document.
     *
     * This is invoked by VS Code when there are no more references to a given `CustomDocument` (for example when
     * all editors associated with the document have been closed.)
     */
    dispose(): void;
  }

  /**
   * Event triggered by extensions to signal to VS Code that an edit has occurred on an [`CustomDocument`](#CustomDocument).
   *
   * @see [`CustomDocumentProvider.onDidChangeCustomDocument`](#CustomDocumentProvider.onDidChangeCustomDocument).
   */
  interface CustomDocumentEditEvent<T extends CustomDocument = CustomDocument> {

    /**
     * The document that the edit is for.
     */
    readonly document: T;

    /**
     * Undo the edit operation.
     *
     * This is invoked by VS Code when the user undoes this edit. To implement `undo`, your
     * extension should restore the document and editor to the state they were in just before this
     * edit was added to VS Code's internal edit stack by `onDidChangeCustomDocument`.
     */
    undo(): Thenable<void> | void;

    /**
     * Redo the edit operation.
     *
     * This is invoked by VS Code when the user redoes this edit. To implement `redo`, your
     * extension should restore the document and editor to the state they were in just after this
     * edit was added to VS Code's internal edit stack by `onDidChangeCustomDocument`.
     */
    redo(): Thenable<void> | void;

    /**
     * Display name describing the edit.
     *
     * This will be shown to users in the UI for undo/redo operations.
     */
    readonly label?: string;
  }

  /**
   * Event triggered by extensions to signal to VS Code that the content of a [`CustomDocument`](#CustomDocument)
   * has changed.
   *
   * @see [`CustomDocumentProvider.onDidChangeCustomDocument`](#CustomDocumentProvider.onDidChangeCustomDocument).
   */
  interface CustomDocumentContentChangeEvent<T extends CustomDocument = CustomDocument> {
    /**
     * The document that the change is for.
     */
    readonly document: T;
  }

  /**
   * A backup for an [`CustomDocument`](#CustomDocument).
   */
  interface CustomDocumentBackup {
    /**
     * Unique identifier for the backup.
     *
     * This id is passed back to your extension in `openCustomDocument` when opening a custom editor from a backup.
     */
    readonly id: string;

    /**
     * Delete the current backup.
     *
     * This is called by VS Code when it is clear the current backup is no longer needed, such as when a new backup
     * is made or when the file is saved.
     */
    delete(): void;
  }

  /**
   * Additional information used to implement [`CustomEditableDocument.backup`](#CustomEditableDocument.backup).
   */
  interface CustomDocumentBackupContext {
    /**
     * Suggested file location to write the new backup.
     *
     * Note that your extension is free to ignore this and use its own strategy for backup.
     *
     * If the editor is for a resource from the current workspace, `destination` will point to a file inside
     * `ExtensionContext.storagePath`. The parent folder of `destination` may not exist, so make sure to created it
     * before writing the backup to this location.
     */
    readonly destination: Uri;
  }

  /**
   * Additional information about the opening custom document.
   */
  interface CustomDocumentOpenContext {
    /**
     * The id of the backup to restore the document from or `undefined` if there is no backup.
     *
     * If this is provided, your extension should restore the editor from the backup instead of reading the file
     * from the user's workspace.
     */
    readonly backupId?: string;

    untitledDocumentData?: Uint8Array;
  }

  /**
   * Provider for readonly custom editors that use a custom document model.
   *
   * Custom editors use [`CustomDocument`](#CustomDocument) as their document model instead of a [`TextDocument`](#TextDocument).
   *
   * You should use this type of custom editor when dealing with binary files or more complex scenarios. For simple
   * text based documents, use [`CustomTextEditorProvider`](#CustomTextEditorProvider) instead.
   *
   * @param T Type of the custom document returned by this provider.
   */
  export interface CustomReadonlyEditorProvider<T extends CustomDocument = CustomDocument> {

    /**
     * Create a new document for a given resource.
     *
     * `openCustomDocument` is called when the first time an editor for a given resource is opened. The opened
     * document is then passed to `resolveCustomEditor` so that the editor can be shown to the user.
     *
     * Already opened `CustomDocument` are re-used if the user opened additional editors. When all editors for a
     * given resource are closed, the `CustomDocument` is disposed of. Opening an editor at this point will
     * trigger another call to `openCustomDocument`.
     *
     * @param uri Uri of the document to open.
     * @param openContext Additional information about the opening custom document.
     * @param token A cancellation token that indicates the result is no longer needed.
     *
     * @return The custom document.
     */
    openCustomDocument(uri: Uri, openContext: CustomDocumentOpenContext, token: CancellationToken): Thenable<T> | T;

    /**
     * Resolve a custom editor for a given resource.
     *
     * This is called whenever the user opens a new editor for this `CustomEditorProvider`.
     *
     * @param document Document for the resource being resolved.
     *
     * @param webviewPanel The webview panel used to display the editor UI for this resource.
     *
     * During resolve, the provider must fill in the initial html for the content webview panel and hook up all
     * the event listeners on it that it is interested in. The provider can also hold onto the `WebviewPanel` to
     * use later for example in a command. See [`WebviewPanel`](#WebviewPanel) for additional details.
     *
     * @param token A cancellation token that indicates the result is no longer needed.
     *
     * @return Optional thenable indicating that the custom editor has been resolved.
     */
    resolveCustomEditor(document: T, webviewPanel: WebviewPanel, token: CancellationToken): Thenable<void> | void;
  }

  /**
   * Provider for editable custom editors that use a custom document model.
   *
   * Custom editors use [`CustomDocument`](#CustomDocument) as their document model instead of a [`TextDocument`](#TextDocument).
   * This gives extensions full control over actions such as edit, save, and backup.
   *
   * You should use this type of custom editor when dealing with binary files or more complex scenarios. For simple
   * text based documents, use [`CustomTextEditorProvider`](#CustomTextEditorProvider) instead.
   *
   * @param T Type of the custom document returned by this provider.
   */
  export interface CustomEditorProvider<T extends CustomDocument = CustomDocument> extends CustomReadonlyEditorProvider<T> {
    /**
     * Signal that an edit has occurred inside a custom editor.
     *
     * This event must be fired by your extension whenever an edit happens in a custom editor. An edit can be
     * anything from changing some text, to cropping an image, to reordering a list. Your extension is free to
     * define what an edit is and what data is stored on each edit.
     *
     * Firing `onDidChange` causes VS Code to mark the editors as being dirty. This is cleared when the user either
     * saves or reverts the file.
     *
     * Editors that support undo/redo must fire a `CustomDocumentEditEvent` whenever an edit happens. This allows
     * users to undo and redo the edit using VS Code's standard VS Code keyboard shortcuts. VS Code will also mark
     * the editor as no longer being dirty if the user undoes all edits to the last saved state.
     *
     * Editors that support editing but cannot use VS Code's standard undo/redo mechanism must fire a `CustomDocumentContentChangeEvent`.
     * The only way for a user to clear the dirty state of an editor that does not support undo/redo is to either
     * `save` or `revert` the file.
     *
     * An editor should only ever fire `CustomDocumentEditEvent` events, or only ever fire `CustomDocumentContentChangeEvent` events.
     */
    readonly onDidChangeCustomDocument: Event<CustomDocumentEditEvent<T>> | Event<CustomDocumentContentChangeEvent<T>>;

    /**
     * Save a custom document.
     *
     * This method is invoked by VS Code when the user saves a custom editor. This can happen when the user
     * triggers save while the custom editor is active, by commands such as `save all`, or by auto save if enabled.
     *
     * To implement `save`, the implementer must persist the custom editor. This usually means writing the
     * file data for the custom document to disk. After `save` completes, any associated editor instances will
     * no longer be marked as dirty.
     *
     * @param document Document to save.
     * @param cancellation Token that signals the save is no longer required (for example, if another save was triggered).
     *
     * @return Thenable signaling that saving has completed.
     */
    saveCustomDocument(document: T, cancellation: CancellationToken): Thenable<void>;

    /**
     * Save a custom document to a different location.
     *
     * This method is invoked by VS Code when the user triggers 'save as' on a custom editor. The implementer must
     * persist the custom editor to `destination`.
     *
     * When the user accepts save as, the current editor is be replaced by an non-dirty editor for the newly saved file.
     *
     * @param document Document to save.
     * @param destination Location to save to.
     * @param cancellation Token that signals the save is no longer required.
     *
     * @return Thenable signaling that saving has completed.
     */
    saveCustomDocumentAs(document: T, destination: Uri, cancellation: CancellationToken): Thenable<void>;

    /**
     * Revert a custom document to its last saved state.
     *
     * This method is invoked by VS Code when the user triggers `File: Revert File` in a custom editor. (Note that
     * this is only used using VS Code's `File: Revert File` command and not on a `git revert` of the file).
     *
     * To implement `revert`, the implementer must make sure all editor instances (webviews) for `document`
     * are displaying the document in the same state is saved in. This usually means reloading the file from the
     * workspace.
     *
     * @param document Document to revert.
     * @param cancellation Token that signals the revert is no longer required.
     *
     * @return Thenable signaling that the change has completed.
     */
    revertCustomDocument(document: T, cancellation: CancellationToken): Thenable<void>;

    /**
     * Back up a dirty custom document.
     *
     * Backups are used for hot exit and to prevent data loss. Your `backup` method should persist the resource in
     * its current state, i.e. with the edits applied. Most commonly this means saving the resource to disk in
     * the `ExtensionContext.storagePath`. When VS Code reloads and your custom editor is opened for a resource,
     * your extension should first check to see if any backups exist for the resource. If there is a backup, your
     * extension should load the file contents from there instead of from the resource in the workspace.
     *
     * `backup` is triggered approximately one second after the the user stops editing the document. If the user
     * rapidly edits the document, `backup` will not be invoked until the editing stops.
     *
     * `backup` is not invoked when `auto save` is enabled (since auto save already persists the resource).
     *
     * @param document Document to backup.
     * @param context Information that can be used to backup the document.
     * @param cancellation Token that signals the current backup since a new backup is coming in. It is up to your
     * extension to decided how to respond to cancellation. If for example your extension is backing up a large file
     * in an operation that takes time to complete, your extension may decide to finish the ongoing backup rather
     * than cancelling it to ensure that VS Code has some valid backup.
     */
    backupCustomDocument(document: T, context: CustomDocumentBackupContext, cancellation: CancellationToken): Thenable<CustomDocumentBackup>;
  }

}

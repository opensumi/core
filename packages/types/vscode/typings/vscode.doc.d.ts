declare module 'vscode' {
	/**
	 * Represents a text document, such as a source file. Text documents have
	 * [lines](#TextLine) and knowledge about an underlying resource like a file.
	 */
	export interface TextDocument {

		/**
		 * The associated uri for this document.
		 *
		 * *Note* that most documents use the `file`-scheme, which means they are files on disk. However, **not** all documents are
		 * saved on disk and therefore the `scheme` must be checked before trying to access the underlying file or siblings on disk.
		 *
		 * @see [FileSystemProvider](#FileSystemProvider)
		 * @see [TextDocumentContentProvider](#TextDocumentContentProvider)
		 */
		readonly uri: Uri;

		/**
		 * The file system path of the associated resource. Shorthand
		 * notation for [TextDocument.uri.fsPath](#TextDocument.uri). Independent of the uri scheme.
		 */
		readonly fileName: string;

		/**
		 * Is this document representing an untitled file which has never been saved yet. *Note* that
		 * this does not mean the document will be saved to disk, use [`uri.scheme`](#Uri.scheme)
		 * to figure out where a document will be [saved](#FileSystemProvider), e.g. `file`, `ftp` etc.
		 */
		readonly isUntitled: boolean;

		/**
		 * The identifier of the language associated with this document.
		 */
		readonly languageId: string;

		/**
		 * The version number of this document (it will strictly increase after each
		 * change, including undo/redo).
		 */
		readonly version: number;

		/**
		 * `true` if there are unpersisted changes.
		 */
		readonly isDirty: boolean;

		/**
		 * `true` if the document have been closed. A closed document isn't synchronized anymore
		 * and won't be re-used when the same resource is opened again.
		 */
		readonly isClosed: boolean;

		/**
		 * Save the underlying file.
		 *
		 * @return A promise that will resolve to true when the file
		 * has been saved. If the file was not dirty or the save failed,
		 * will return false.
		 */
		save(): Thenable<boolean>;

		/**
		 * The [end of line](#EndOfLine) sequence that is predominately
		 * used in this document.
		 */
		readonly eol: EndOfLine;

		/**
		 * The number of lines in this document.
		 */
		readonly lineCount: number;

		/**
		 * Returns a text line denoted by the line number. Note
		 * that the returned object is *not* live and changes to the
		 * document are not reflected.
		 *
		 * @param line A line number in [0, lineCount).
		 * @return A [line](#TextLine).
		 */
		lineAt(line: number): TextLine;

		/**
		 * Returns a text line denoted by the position. Note
		 * that the returned object is *not* live and changes to the
		 * document are not reflected.
		 *
		 * The position will be [adjusted](#TextDocument.validatePosition).
		 *
		 * @see [TextDocument.lineAt](#TextDocument.lineAt)
		 * @param position A position.
		 * @return A [line](#TextLine).
		 */
		lineAt(position: Position): TextLine;

		/**
		 * Converts the position to a zero-based offset.
		 *
		 * The position will be [adjusted](#TextDocument.validatePosition).
		 *
		 * @param position A position.
		 * @return A valid zero-based offset.
		 */
		offsetAt(position: Position): number;

		/**
		 * Converts a zero-based offset to a position.
		 *
		 * @param offset A zero-based offset.
		 * @return A valid [position](#Position).
		 */
		positionAt(offset: number): Position;

		/**
		 * Get the text of this document. A substring can be retrieved by providing
		 * a range. The range will be [adjusted](#TextDocument.validateRange).
		 *
		 * @param range Include only the text included by the range.
		 * @return The text inside the provided range or the entire text.
		 */
		getText(range?: Range): string;

		/**
		 * Get a word-range at the given position. By default words are defined by
		 * common separators, like space, -, _, etc. In addition, per language custom
		 * [word definitions](#LanguageConfiguration.wordPattern) can be defined. It
		 * is also possible to provide a custom regular expression.
		 *
		 * * *Note 1:* A custom regular expression must not match the empty string and
		 * if it does, it will be ignored.
		 * * *Note 2:* A custom regular expression will fail to match multiline strings
		 * and in the name of speed regular expressions should not match words with
		 * spaces. Use [`TextLine.text`](#TextLine.text) for more complex, non-wordy, scenarios.
		 *
		 * The position will be [adjusted](#TextDocument.validatePosition).
		 *
		 * @param position A position.
		 * @param regex Optional regular expression that describes what a word is.
		 * @return A range spanning a word, or `undefined`.
		 */
		getWordRangeAtPosition(position: Position, regex?: RegExp): Range | undefined;

		/**
		 * Ensure a range is completely contained in this document.
		 *
		 * @param range A range.
		 * @return The given range or a new, adjusted range.
		 */
		validateRange(range: Range): Range;

		/**
		 * Ensure a position is contained in the range of this document.
		 *
		 * @param position A position.
		 * @return The given position or a new, adjusted position.
		 */
		validatePosition(position: Position): Position;
	}

	/**
	 * A text document content provider allows to add readonly documents
	 * to the editor, such as source from a dll or generated html from md.
	 *
	 * Content providers are [registered](#workspace.registerTextDocumentContentProvider)
	 * for a [uri-scheme](#Uri.scheme). When a uri with that scheme is to
	 * be [loaded](#workspace.openTextDocument) the content provider is
	 * asked.
	 */
	export interface TextDocumentContentProvider {

		/**
		 * An event to signal a resource has changed.
		 */
		onDidChange?: Event<Uri>;

		/**
		 * Provide textual content for a given uri.
		 *
		 * The editor will use the returned string-content to create a readonly
		 * [document](#TextDocument). Resources allocated should be released when
		 * the corresponding document has been [closed](#workspace.onDidCloseTextDocument).
		 *
		 * **Note**: The contents of the created [document](#TextDocument) might not be
		 * identical to the provided text due to end-of-line-sequence normalization.
		 *
		 * @param uri An uri which scheme matches the scheme this provider was [registered](#workspace.registerTextDocumentContentProvider) for.
		 * @param token A cancellation token.
		 * @return A string or a thenable that resolves to such.
		 */
		provideTextDocumentContent(uri: Uri, token: CancellationToken): ProviderResult<string>;
	}

	/**
	 * An event describing an individual change in the text of a [document](#TextDocument).
	 */
	export interface TextDocumentContentChangeEvent {
		/**
		 * The range that got replaced.
		 */
		range: Range;
		/**
		 * The offset of the range that got replaced.
		 */
		rangeOffset: number;
		/**
		 * The length of the range that got replaced.
		 */
		rangeLength: number;
		/**
		 * The new text for the range.
		 */
		text: string;
	}


	/**
	 * An event that is fired when a [document](#TextDocument) will be saved.
	 *
	 * To make modifications to the document before it is being saved, call the
	 * [`waitUntil`](#TextDocumentWillSaveEvent.waitUntil)-function with a thenable
	 * that resolves to an array of [text edits](#TextEdit).
	 */
	export interface TextDocumentWillSaveEvent {

		/**
		 * The document that will be saved.
		 */
		readonly document: TextDocument;

		/**
		 * The reason why save was triggered.
		 */
		readonly reason: TextDocumentSaveReason;

		/**
		 * Allows to pause the event loop and to apply [pre-save-edits](#TextEdit).
		 * Edits of subsequent calls to this function will be applied in order. The
		 * edits will be *ignored* if concurrent modifications of the document happened.
		 *
		 * *Note:* This function can only be called during event dispatch and not
		 * in an asynchronous manner:
		 *
		 * ```ts
		 * workspace.onWillSaveTextDocument(event => {
		 * 	// async, will *throw* an error
		 * 	setTimeout(() => event.waitUntil(promise));
		 *
		 * 	// sync, OK
		 * 	event.waitUntil(promise);
		 * })
		 * ```
		 *
		 * @param thenable A thenable that resolves to [pre-save-edits](#TextEdit).
		 */
		waitUntil(thenable: Thenable<TextEdit[]>): void;

		/**
		 * Allows to pause the event loop until the provided thenable resolved.
		 *
		 * *Note:* This function can only be called during event dispatch.
		 *
		 * @param thenable A thenable that delays saving.
		 */
		waitUntil(thenable: Thenable<any>): void;
	}

	/**
	 * A notebook cell kind.
	 */
	export enum NotebookCellKind {

		/**
		 * A markup-cell is formatted source that is used for display.
		 */
		Markup = 1,

		/**
		 * A code-cell is source that can be {@link NotebookController executed} and that
		 * produces {@link NotebookCellOutput output}.
		 */
		Code = 2
	}

	/**
	 * Represents a cell of a {@link NotebookDocument notebook}, either a {@link NotebookCellKind.Code code}-cell
	 * or {@link NotebookCellKind.Markup markup}-cell.
	 *
	 * NotebookCell instances are immutable and are kept in sync for as long as they are part of their notebook.
	 */
	export interface NotebookCell {

		/**
		 * The index of this cell in its {@link NotebookDocument.cellAt containing notebook}. The
		 * index is updated when a cell is moved within its notebook. The index is `-1`
		 * when the cell has been removed from its notebook.
		 */
		readonly index: number;

		/**
		 * The {@link NotebookDocument notebook} that contains this cell.
		 */
		readonly notebook: NotebookDocument;

		/**
		 * The kind of this cell.
		 */
		readonly kind: NotebookCellKind;

		/**
		 * The {@link TextDocument text} of this cell, represented as text document.
		 */
		readonly document: TextDocument;

		/**
		 * The metadata of this cell. Can be anything but must be JSON-stringifyable.
		 */
		readonly metadata: { readonly [key: string]: any };

		/**
		 * The outputs of this cell.
		 */
		readonly outputs: readonly NotebookCellOutput[];

		/**
		 * The most recent {@link NotebookCellExecutionSummary execution summary} for this cell.
		 */
		readonly executionSummary: NotebookCellExecutionSummary | undefined;

		/**
		 * proposed api
		 * Mime type determines how the markup cell's `value` is interpreted.
		 *
		 * The mime selects which notebook renders is used to render the cell.
		 *
		 * If not set, internally the cell is treated as having a mime type of `text/plain`.
		 * Cells that set `language` to `markdown` instead are treated as `text/markdown`.
		 */
		mime: string | undefined;
	}

  /**
	 * Represents a notebook which itself is a sequence of {@link NotebookCell code or markup cells}. Notebook documents are
	 * created from {@link NotebookData notebook data}.
	 */
	export interface NotebookDocument {

		/**
		 * The associated uri for this notebook.
		 *
		 * *Note* that most notebooks use the `file`-scheme, which means they are files on disk. However, **not** all notebooks are
		 * saved on disk and therefore the `scheme` must be checked before trying to access the underlying file or siblings on disk.
		 *
		 * @see {@link FileSystemProvider}
		 */
		readonly uri: Uri;

		/**
		 * The type of notebook.
		 */
		readonly notebookType: string;

		/**
		 * The version number of this notebook (it will strictly increase after each
		 * change, including undo/redo).
		 */
		readonly version: number;

		/**
		 * `true` if there are unpersisted changes.
		 */
		readonly isDirty: boolean;

		/**
		 * Is this notebook representing an untitled file which has not been saved yet.
		 */
		readonly isUntitled: boolean;

		/**
		 * `true` if the notebook has been closed. A closed notebook isn't synchronized anymore
		 * and won't be re-used when the same resource is opened again.
		 */
		readonly isClosed: boolean;

		/**
		 * Arbitrary metadata for this notebook. Can be anything but must be JSON-stringifyable.
		 */
		readonly metadata: { [key: string]: any };

		/**
		 * The number of cells in the notebook.
		 */
		readonly cellCount: number;

		/**
		 * Return the cell at the specified index. The index will be adjusted to the notebook.
		 *
		 * @param index - The index of the cell to retrieve.
		 * @returns A {@link NotebookCell cell}.
		 */
		cellAt(index: number): NotebookCell;

		/**
		 * Get the cells of this notebook. A subset can be retrieved by providing
		 * a range. The range will be adjusted to the notebook.
		 *
		 * @param range A notebook range.
		 * @returns The cells contained by the range or all cells.
		 */
		getCells(range?: NotebookRange): NotebookCell[];

		/**
		 * Save the document. The saving will be handled by the corresponding {@link NotebookSerializer serializer}.
		 *
		 * @returns A promise that will resolve to true when the document
		 * has been saved. Will return false if the file was not dirty or when save failed.
		 */
		save(): Thenable<boolean>;
	}

	/**
	 * Describes a change to a notebook cell.
	 *
	 * @see {@link NotebookDocumentChangeEvent}
	 */
	export interface NotebookDocumentCellChange {

		/**
		 * The affected cell.
		 */
		readonly cell: NotebookCell;

		/**
		 * The document of the cell or `undefined` when it did not change.
		 *
		 * *Note* that you should use the {@link workspace.onDidChangeTextDocument onDidChangeTextDocument}-event
		 * for detailed change information, like what edits have been performed.
		 */
		readonly document: TextDocument | undefined;

		/**
		 * The new metadata of the cell or `undefined` when it did not change.
		 */
		readonly metadata: { [key: string]: any } | undefined;

		/**
		 * The new outputs of the cell or `undefined` when they did not change.
		 */
		readonly outputs: readonly NotebookCellOutput[] | undefined;

		/**
		 * The new execution summary of the cell or `undefined` when it did not change.
		 */
		readonly executionSummary: NotebookCellExecutionSummary | undefined;
	}

	/**
	 * Describes a structural change to a notebook document, e.g newly added and removed cells.
	 *
	 * @see {@link NotebookDocumentChangeEvent}
	 */
	export interface NotebookDocumentContentChange {

		/**
		 * The range at which cells have been either added or removed.
		 *
		 * Note that no cells have been {@link NotebookDocumentContentChange.removedCells removed}
		 * when this range is {@link NotebookRange.isEmpty empty}.
		 */
		readonly range: NotebookRange;

		/**
		 * Cells that have been added to the document.
		 */
		readonly addedCells: readonly NotebookCell[];

		/**
		 * Cells that have been removed from the document.
		 */
		readonly removedCells: readonly NotebookCell[];
	}

	/**
	 * An event describing a transactional {@link NotebookDocument notebook} change.
	 */
	export interface NotebookDocumentChangeEvent {

		/**
		 * The affected notebook.
		 */
		readonly notebook: NotebookDocument;

		/**
		 * The new metadata of the notebook or `undefined` when it did not change.
		 */
		readonly metadata: { [key: string]: any } | undefined;

		/**
		 * An array of content changes describing added or removed {@link NotebookCell cells}.
		 */
		readonly contentChanges: readonly NotebookDocumentContentChange[];

		/**
		 * An array of {@link NotebookDocumentCellChange cell changes}.
		 */
		readonly cellChanges: readonly NotebookDocumentCellChange[];
	}

	/**
	 * An event that is fired when a {@link NotebookDocument notebook document} will be saved.
	 *
	 * To make modifications to the document before it is being saved, call the
	 * {@linkcode NotebookDocumentWillSaveEvent.waitUntil waitUntil}-function with a thenable
	 * that resolves to a {@link WorkspaceEdit workspace edit}.
	 */
	export interface NotebookDocumentWillSaveEvent {
		/**
		 * A cancellation token.
		 */
		readonly token: CancellationToken;

		/**
		 * The {@link NotebookDocument notebook document} that will be saved.
		 */
		readonly notebook: NotebookDocument;

		/**
		 * The reason why save was triggered.
		 */
		readonly reason: TextDocumentSaveReason;

		/**
		 * Allows to pause the event loop and to apply {@link WorkspaceEdit workspace edit}.
		 * Edits of subsequent calls to this function will be applied in order. The
		 * edits will be *ignored* if concurrent modifications of the notebook document happened.
		 *
		 * *Note:* This function can only be called during event dispatch and not
		 * in an asynchronous manner:
		 *
		 * ```ts
		 * workspace.onWillSaveNotebookDocument(event => {
		 * 	// async, will *throw* an error
		 * 	setTimeout(() => event.waitUntil(promise));
		 *
		 * 	// sync, OK
		 * 	event.waitUntil(promise);
		 * })
		 * ```
		 *
		 * @param thenable A thenable that resolves to {@link WorkspaceEdit workspace edit}.
		 */
		waitUntil(thenable: Thenable<WorkspaceEdit>): void;

		/**
		 * Allows to pause the event loop until the provided thenable resolved.
		 *
		 * *Note:* This function can only be called during event dispatch.
		 *
		 * @param thenable A thenable that delays saving.
		 */
		waitUntil(thenable: Thenable<any>): void;
	}

  /**
	 * The summary of a notebook cell execution.
	 */
	export interface NotebookCellExecutionSummary {

		/**
		 * The order in which the execution happened.
		 */
		readonly executionOrder?: number;

		/**
		 * If the execution finished successfully.
		 */
		readonly success?: boolean;

		/**
		 * The times at which execution started and ended, as unix timestamps
		 */
		readonly timing?: {
			/**
			 * Execution start time.
			 */
			readonly startTime: number;
			/**
			 * Execution end time.
			 */
			readonly endTime: number;
		};
	}

	/**
	 * A notebook range represents an ordered pair of two cell indices.
	 * It is guaranteed that start is less than or equal to end.
	 */
	export class NotebookRange {

		/**
		 * The zero-based start index of this range.
		 */
		readonly start: number;

		/**
		 * The exclusive end index of this range (zero-based).
		 */
		readonly end: number;

		/**
		 * `true` if `start` and `end` are equal.
		 */
		readonly isEmpty: boolean;

		/**
		 * Create a new notebook range. If `start` is not
		 * before or equal to `end`, the values will be swapped.
		 *
		 * @param start start index
		 * @param end end index.
		 */
		constructor(start: number, end: number);

		/**
		 * Derive a new range for this range.
		 *
		 * @param change An object that describes a change to this range.
		 * @returns A range that reflects the given change. Will return `this` range if the change
		 * is not changing anything.
		 */
		with(change: {
			/**
			 * New start index, defaults to `this.start`.
			 */
			start?: number;
			/**
			 * New end index, defaults to `this.end`.
			 */
			end?: number;
		}): NotebookRange;
	}

	/**
	 * One representation of a {@link NotebookCellOutput notebook output}, defined by MIME type and data.
	 */
	export class NotebookCellOutputItem {

		/**
		 * Factory function to create a `NotebookCellOutputItem` from a string.
		 *
		 * *Note* that an UTF-8 encoder is used to create bytes for the string.
		 *
		 * @param value A string.
		 * @param mime Optional MIME type, defaults to `text/plain`.
		 * @returns A new output item object.
		 */
		static text(value: string, mime?: string): NotebookCellOutputItem;

		/**
		 * Factory function to create a `NotebookCellOutputItem` from
		 * a JSON object.
		 *
		 * *Note* that this function is not expecting "stringified JSON" but
		 * an object that can be stringified. This function will throw an error
		 * when the passed value cannot be JSON-stringified.
		 *
		 * @param value A JSON-stringifyable value.
		 * @param mime Optional MIME type, defaults to `application/json`
		 * @returns A new output item object.
		 */
		static json(value: any, mime?: string): NotebookCellOutputItem;

		/**
		 * Factory function to create a `NotebookCellOutputItem` that uses
		 * uses the `application/vnd.code.notebook.stdout` mime type.
		 *
		 * @param value A string.
		 * @returns A new output item object.
		 */
		static stdout(value: string): NotebookCellOutputItem;

		/**
		 * Factory function to create a `NotebookCellOutputItem` that uses
		 * uses the `application/vnd.code.notebook.stderr` mime type.
		 *
		 * @param value A string.
		 * @returns A new output item object.
		 */
		static stderr(value: string): NotebookCellOutputItem;

		/**
		 * Factory function to create a `NotebookCellOutputItem` that uses
		 * uses the `application/vnd.code.notebook.error` mime type.
		 *
		 * @param value An error object.
		 * @returns A new output item object.
		 */
		static error(value: Error): NotebookCellOutputItem;

		/**
		 * The mime type which determines how the {@linkcode NotebookCellOutputItem.data data}-property
		 * is interpreted.
		 *
		 * Notebooks have built-in support for certain mime-types, extensions can add support for new
		 * types and override existing types.
		 */
		mime: string;

		/**
		 * The data of this output item. Must always be an array of unsigned 8-bit integers.
		 */
		data: Uint8Array;

		/**
		 * Create a new notebook cell output item.
		 *
		 * @param data The value of the output item.
		 * @param mime The mime type of the output item.
		 */
		constructor(data: Uint8Array, mime: string);
	}

	/**
	 * Notebook cell output represents a result of executing a cell. It is a container type for multiple
	 * {@link NotebookCellOutputItem output items} where contained items represent the same result but
	 * use different MIME types.
	 */
	export class NotebookCellOutput {


		/**
		 * @deprecated
		 */
		id: string;

		/**
		 * The output items of this output. Each item must represent the same result. _Note_ that repeated
		 * MIME types per output is invalid and that the editor will just pick one of them.
		 *
		 * ```ts
		 * new vscode.NotebookCellOutput([
		 * 	vscode.NotebookCellOutputItem.text('Hello', 'text/plain'),
		 * 	vscode.NotebookCellOutputItem.text('<i>Hello</i>', 'text/html'),
		 * 	vscode.NotebookCellOutputItem.text('_Hello_', 'text/markdown'),
		 * 	vscode.NotebookCellOutputItem.text('Hey', 'text/plain'), // INVALID: repeated type, editor will pick just one
		 * ])
		 * ```
		 */
		items: NotebookCellOutputItem[];

		/**
		 * Arbitrary metadata for this cell output. Can be anything but must be JSON-stringifyable.
		 */
		metadata?: { [key: string]: any };

		/**
		 * Create new notebook output.
		 *
		 * @param items Notebook output items.
		 * @param metadata Optional metadata.
		 */
		constructor(items: NotebookCellOutputItem[], metadata?: { [key: string]: any });
	}

	/**
	 * NotebookCellData is the raw representation of notebook cells. Its is part of {@linkcode NotebookData}.
	 */
	export class NotebookCellData {

		/**
		 * The {@link NotebookCellKind kind} of this cell data.
		 */
		kind: NotebookCellKind;

		/**
		 * The source value of this cell data - either source code or formatted text.
		 */
		value: string;

		/**
		 * The language identifier of the source value of this cell data. Any value from
		 * {@linkcode languages.getLanguages getLanguages} is possible.
		 */
		languageId: string;

		/**
		 * The outputs of this cell data.
		 */
		outputs?: NotebookCellOutput[];

		/**
		 * Arbitrary metadata of this cell data. Can be anything but must be JSON-stringifyable.
		 */
		metadata?: { [key: string]: any };

		/**
		 * The execution summary of this cell data.
		 */
		executionSummary?: NotebookCellExecutionSummary;

		/**
		 * Mime type determines how the cell's `value` is interpreted.
		 *
		 * The mime selects which notebook renders is used to render the cell.
		 *
		 * If not set, internally the cell is treated as having a mime type of `text/plain`.
		 * Cells that set `language` to `markdown` instead are treated as `text/markdown`.
		 */
		mime?: string;

		/**
		 * Create new cell data. Minimal cell data specifies its kind, its source value, and the
		 * language identifier of its source.
		 *
		 * @param kind The kind.
		 * @param value The source value.
		 * @param languageId The language identifier of the source value.
		 */
		constructor(kind: NotebookCellKind, value: string, languageId: string);
	}

	/**
	 * Raw representation of a notebook.
	 *
	 * Extensions are responsible for creating {@linkcode NotebookData} so that the editor
	 * can create a {@linkcode NotebookDocument}.
	 *
	 * @see {@link NotebookSerializer}
	 */
	export class NotebookData {
		/**
		 * The cell data of this notebook data.
		 */
		cells: NotebookCellData[];

		/**
		 * Arbitrary metadata of notebook data.
		 */
		metadata?: { [key: string]: any };

		/**
		 * Create new notebook data.
		 *
		 * @param cells An array of cell data.
		 */
		constructor(cells: NotebookCellData[]);
	}
}


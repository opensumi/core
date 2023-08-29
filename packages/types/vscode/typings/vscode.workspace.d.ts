declare module 'vscode' {
  /**
   * An event describing a change to the set of [workspace folders](#workspace.workspaceFolders).
   */
  export interface WorkspaceFoldersChangeEvent {
    /**
     * Added workspace folders.
     */
    readonly added: ReadonlyArray<WorkspaceFolder>;

    /**
     * Removed workspace folders.
     */
    readonly removed: ReadonlyArray<WorkspaceFolder>;
  }

  /**
   *  Options to configure the behaviour of the [workspace folder](#WorkspaceFolder) pick UI.
   */
  export interface WorkspaceFolderPickOptions {

    /**
     * An optional string to show as place holder in the input box to guide the user what to pick on.
     */
    placeHolder?: string;

    /**
     * Set to `true` to keep the picker open when focus moves to another part of the editor or to another window.
     */
    ignoreFocusOut?: boolean;
  }

  export namespace workspace {
    export const fs: FileSystem;


    /**
     * When true, the user has explicitly trusted the contents of the workspace.
     * TODO: 内部无此类需求，先空实现，等有需求再做
     */
    export const isTrusted: boolean;

    /**
     * Event that fires when the current workspace has been trusted.
     * TODO: 内部无此类需求，先空实现，等有需求再做
     */
    export const onDidGrantWorkspaceTrust: Event<void>;

    /**
     * Returns the [workspace folder](#WorkspaceFolder) that contains a given uri.
     * * returns `undefined` when the given uri doesn't match any workspace folder
     * * returns the *input* when the given uri is a workspace folder itself
     *
     * @param uri An uri.
     * @return A workspace folder or `undefined`
     */
    export function getWorkspaceFolder(uri: Uri): WorkspaceFolder | undefined;

    /**
     * Make changes to one or many resources or create, delete, and rename resources as defined by the given
     * [workspace edit](#WorkspaceEdit).
     *
     * All changes of a workspace edit are applied in the same order in which they have been added. If
     * multiple textual inserts are made at the same position, these strings appear in the resulting text
     * in the order the 'inserts' were made. Invalid sequences like 'delete file a' -> 'insert text in file a'
     * cause failure of the operation.
     *
     * When applying a workspace edit that consists only of text edits an 'all-or-nothing'-strategy is used.
     * A workspace edit with resource creations or deletions aborts the operation, e.g. consecutive edits will
     * not be attempted, when a single edit fails.
     *
     * @param edit A workspace edit.
     * @return A thenable that resolves when the edit could be applied.
     */
    export function applyEdit(edit: WorkspaceEdit): Thenable<boolean>;

    /**
     * Get a workspace configuration object.
     *
     * When a section-identifier is provided only that part of the configuration
     * is returned. Dots in the section-identifier are interpreted as child-access,
     * like `{ myExt: { setting: { doIt: true }}}` and `getConfiguration('myExt.setting').get('doIt') === true`.
     *
     * When a resource is provided, configuration scoped to that resource is returned.
     *
     * @param section A dot-separated identifier.
     * @param resource A resource for which the configuration is asked for
     * @return The full configuration or a subset.
     */
    export function getConfiguration(section?: string, resource?: Uri | null): WorkspaceConfiguration;

    /**
     * An event that is emitted when the [configuration](#WorkspaceConfiguration) changed.
     */
    export const onDidChangeConfiguration: Event<ConfigurationChangeEvent>;

    /**
     * Returns the [workspace folder](#WorkspaceFolder) that contains a given uri.
     * * returns `undefined` when the given uri doesn't match any workspace folder
     * * returns the *input* when the given uri is a workspace folder itself
     *
     * @param uri An uri.
     * @return A workspace folder or `undefined`
     */
    export function getWorkspaceFolder(uri: Uri): WorkspaceFolder | undefined;

    /**
     * Opens a document. Will return early if this document is already open. Otherwise
     * the document is loaded and the [didOpen](#workspace.onDidOpenTextDocument)-event fires.
     *
     * The document is denoted by an [uri](#Uri). Depending on the [scheme](#Uri.scheme) the
     * following rules apply:
     * * `file`-scheme: Open a file on disk, will be rejected if the file does not exist or cannot be loaded.
     * * `untitled`-scheme: A new file that should be saved on disk, e.g. `untitled:c:\frodo\new.js`. The language
     * will be derived from the file name.
     * * For all other schemes the registered text document content [providers](#TextDocumentContentProvider) are consulted.
     *
     * *Note* that the lifecycle of the returned document is owned by the editor and not by the extension. That means an
     * [`onDidClose`](#workspace.onDidCloseTextDocument)-event can occur at any time after opening it.
     *
     * @param uri Identifies the resource to open.
     * @return A promise that resolves to a [document](#TextDocument).
     */
    export function openTextDocument(uri: Uri): Thenable<TextDocument>;

    /**
     * A short-hand for `openTextDocument(Uri.file(fileName))`.
     *
     * @see [openTextDocument](#openTextDocument)
     * @param fileName A name of a file on disk.
     * @return A promise that resolves to a [document](#TextDocument).
     */
    export function openTextDocument(fileName: string): Thenable<TextDocument>;

    /**
     * Creates a file system watcher.
     *
     * A glob pattern that filters the file events on their absolute path must be provided. Optionally,
     * flags to ignore certain kinds of events can be provided. To stop listening to events the watcher must be disposed.
     *
     * *Note* that only files within the current [workspace folders](#workspace.workspaceFolders) can be watched.
     *
     * @param globPattern A [glob pattern](#GlobPattern) that is applied to the absolute paths of created, changed,
     * and deleted files. Use a [relative pattern](#RelativePattern) to limit events to a certain [workspace folder](#WorkspaceFolder).
     * @param ignoreCreateEvents Ignore when files have been created.
     * @param ignoreChangeEvents Ignore when files have been changed.
     * @param ignoreDeleteEvents Ignore when files have been deleted.
     * @return A new file system watcher instance.
     */
    export function createFileSystemWatcher(globPattern: GlobPattern, ignoreCreateEvents?: boolean, ignoreChangeEvents?: boolean, ignoreDeleteEvents?: boolean): FileSystemWatcher;

    /**
     * Register a filesystem provider for a given scheme, e.g. `ftp`.
     *
     * There can only be one provider per scheme and an error is being thrown when a scheme
     * has been claimed by another provider or when it is reserved.
     *
     * @param scheme The uri-[scheme](#Uri.scheme) the provider registers for.
     * @param provider The filesystem provider.
     * @param options Immutable metadata about the provider.
     * @return A [disposable](#Disposable) that unregisters this provider when being disposed.
     */
    export function registerFileSystemProvider(scheme: string, provider: FileSystemProvider, options?: { isCaseSensitive?: boolean, isReadonly?: boolean }): Disposable;

    /**
     * Opens an untitled text document. The editor will prompt the user for a file
     * path when the document is to be saved. The `options` parameter allows to
     * specify the *language* and/or the *content* of the document.
     *
     * @param options Options to control how the document will be created.
     * @return A promise that resolves to a [document](#TextDocument).
     */
    export function openTextDocument(options?: { language?: string; content?: string; }): Thenable<TextDocument>;

    /**
     * Register a text document content provider.
     *
     * Only one provider can be registered per scheme.
     *
     * @param scheme The uri-scheme to register for.
     * @param provider A content provider.
     * @return A [disposable](#Disposable) that unregisters this provider when being disposed.
     */
    export function registerTextDocumentContentProvider(scheme: string, provider: TextDocumentContentProvider): Disposable;

    /**
     * An event that is emitted when a [text document](#TextDocument) is opened or when the language id
     * of a text document [has been changed](#languages.setTextDocumentLanguage).
     *
     * To add an event listener when a visible text document is opened, use the [TextEditor](#TextEditor) events in the
     * [window](#window) namespace. Note that:
     *
     * - The event is emitted before the [document](#TextDocument) is updated in the
     * [active text editor](#window.activeTextEditor)
     * - When a [text document](#TextDocument) is already open (e.g.: open in another [visible text editor](#window.visibleTextEditors)) this event is not emitted
     *
     */
    export const onDidOpenTextDocument: Event<TextDocument>;

    /**
     * An event that is emitted when a [text document](#TextDocument) is disposed or when the language id
     * of a text document [has been changed](#languages.setTextDocumentLanguage).
     *
     * To add an event listener when a visible text document is closed, use the [TextEditor](#TextEditor) events in the
     * [window](#window) namespace. Note that this event is not emitted when a [TextEditor](#TextEditor) is closed
     * but the document remains open in another [visible text editor](#window.visibleTextEditors).
     */
    export const onDidCloseTextDocument: Event<TextDocument>;

    /**
     * An event that is emitted when a [text document](#TextDocument) is changed. This usually happens
     * when the [contents](#TextDocument.getText) changes but also when other things like the
     * [dirty](#TextDocument.isDirty)-state changes.
     */
    export const onDidChangeTextDocument: Event<TextDocumentChangeEvent>;

    /**
     * An event that is emitted when a [text document](#TextDocument) will be saved to disk.
     *
     * *Note 1:* Subscribers can delay saving by registering asynchronous work. For the sake of data integrity the editor
     * might save without firing this event. For instance when shutting down with dirty files.
     *
     * *Note 2:* Subscribers are called sequentially and they can [delay](#TextDocumentWillSaveEvent.waitUntil) saving
     * by registering asynchronous work. Protection against misbehaving listeners is implemented as such:
     *  * there is an overall time budget that all listeners share and if that is exhausted no further listener is called
     *  * listeners that take a long time or produce errors frequently will not be called anymore
     *
     * The current thresholds are 1.5 seconds as overall time budget and a listener can misbehave 3 times before being ignored.
     */
    export const onWillSaveTextDocument: Event<TextDocumentWillSaveEvent>;

    /**
     * An event that is emitted when a [text document](#TextDocument) is saved to disk.
     */
    export const onDidSaveTextDocument: Event<TextDocument>;

    /**
     * All text documents currently known to the system.
     */
    export const textDocuments: TextDocument[];

    /**
     * Register a text document content provider.
     *
     * Only one provider can be registered per scheme.
     *
     * @param scheme The uri-scheme to register for.
     * @param provider A content provider.
     * @return A [disposable](#Disposable) that unregisters this provider when being disposed.
     */
    export function registerTextDocumentContentProvider(scheme: string, provider: TextDocumentContentProvider): Disposable;

    /**
     * Find files across all [workspace folders](#workspace.workspaceFolders) in the workspace.
     *
     * @sample `findFiles('**​/*.js', '**​/node_modules/**', 10)`
     * @param include A [glob pattern](#GlobPattern) that defines the files to search for. The glob pattern
     * will be matched against the file paths of resulting matches relative to their workspace. Use a [relative pattern](#RelativePattern)
     * to restrict the search results to a [workspace folder](#WorkspaceFolder).
     * @param exclude  A [glob pattern](#GlobPattern) that defines files and folders to exclude. The glob pattern
     * will be matched against the file paths of resulting matches relative to their workspace. When `undefined` only default excludes will
     * apply, when `null` no excludes will apply.
     * @param maxResults An upper-bound for the result.
     * @param token A token that can be used to signal cancellation to the underlying search engine.
     * @return A thenable that resolves to an array of resource identifiers. Will return no results if no
     * [workspace folders](#workspace.workspaceFolders) are opened.
     */
    export function findFiles(include: GlobPattern, exclude?: GlobPattern | null, maxResults?: number, token?: CancellationToken): Thenable<Uri[]>;


    /**
     * The location of the workspace file, for example:
     *
     * `file:///Users/name/Development/myProject.code-workspace`
     *
     * or
     *
     * `untitled:1555503116870`
     *
     * for a workspace that is untitled and not yet saved.
     *
     * Depending on the workspace that is opened, the value will be:
     *  * `undefined` when no workspace or  a single folder is opened
     *  * the path of the workspace file as `Uri` otherwise. if the workspace
     * is untitled, the returned URI will use the `untitled:` scheme
     *
     * The location can e.g. be used with the `vscode.openFolder` command to
     * open the workspace again after it has been closed.
     *
     * **Example:**
     * ```typescript
     * vscode.commands.executeCommand('vscode.openFolder', uriOfWorkspace);
     * ```
     *
     * **Note:** it is not advised to use `workspace.workspaceFile` to write
     * configuration data into the file. You can use `workspace.getConfiguration().update()`
     * for that purpose which will work both when a single folder is opened as
     * well as an untitled or saved workspace.
     */
    export const workspaceFile: Uri | undefined;

    /**
     * An event that is emitted when a workspace folder is added or removed.
     */
    export const onDidChangeWorkspaceFolders: Event<WorkspaceFoldersChangeEvent>;

    /**
     * ~~Register a task provider.~~
     *
     * @deprecated Use the corresponding function on the `tasks` namespace instead
     *
     * @param type The task kind type this provider is registered for.
     * @param provider A task provider.
     * @return A [disposable](#Disposable) that unregisters this provider when being disposed.
     */
    export function registerTaskProvider(type: string, provider: TaskProvider): Disposable;

    /**
     * Returns the [workspace folder](#WorkspaceFolder) that contains a given uri.
     * * returns `undefined` when the given uri doesn't match any workspace folder
     * * returns the *input* when the given uri is a workspace folder itself
     *
     * @param uri An uri.
     * @return A workspace folder or `undefined`
     */
    export function getWorkspaceFolder(uri: Uri): WorkspaceFolder | undefined;


    /**
     * ~~The folder that is open in the editor. `undefined` when no folder
     * has been opened.~~
     *
     * @deprecated Use [`workspaceFolders`](#workspace.workspaceFolders) instead.
     */
    export const rootPath: string | undefined;

    /**
     * List of workspace folders or `undefined` when no folder is open.
     * *Note* that the first entry corresponds to the value of `rootPath`.
     */
    export const workspaceFolders: WorkspaceFolder[] | undefined;

    /**
     * The name of the workspace. `undefined` when no folder
     * has been opened.
     */
    export const name: string | undefined;

    /**
     * Returns a path that is relative to the workspace folder or folders.
     *
     * When there are no [workspace folders](#workspace.workspaceFolders) or when the path
     * is not contained in them, the input is returned.
     *
     * @param pathOrUri A path or uri. When a uri is given its [fsPath](#Uri.fsPath) is used.
     * @param includeWorkspaceFolder When `true` and when the given path is contained inside a
     * workspace folder the name of the workspace is prepended. Defaults to `true` when there are
     * multiple workspace folders and `false` otherwise.
     * @return A path relative to the root or the input.
     */
    export function asRelativePath(pathOrUri: string | Uri, includeWorkspaceFolder?: boolean): string;

    /**
     * This method replaces `deleteCount` [workspace folders](#workspace.workspaceFolders) starting at index `start`
     * by an optional set of `workspaceFoldersToAdd` on the `vscode.workspace.workspaceFolders` array. This "splice"
     * behavior can be used to add, remove and change workspace folders in a single operation.
     *
     * If the first workspace folder is added, removed or changed, the currently executing extensions (including the
     * one that called this method) will be terminated and restarted so that the (deprecated) `rootPath` property is
     * updated to point to the first workspace folder.
     *
     * Use the [`onDidChangeWorkspaceFolders()`](#onDidChangeWorkspaceFolders) event to get notified when the
     * workspace folders have been updated.
     *
     * **Example:** adding a new workspace folder at the end of workspace folders
     * ```typescript
     * workspace.updateWorkspaceFolders(workspace.workspaceFolders ? workspace.workspaceFolders.length : 0, null, { uri: ...});
     * ```
     *
     * **Example:** removing the first workspace folder
     * ```typescript
     * workspace.updateWorkspaceFolders(0, 1);
     * ```
     *
     * **Example:** replacing an existing workspace folder with a new one
     * ```typescript
     * workspace.updateWorkspaceFolders(0, 1, { uri: ...});
     * ```
     *
     * It is valid to remove an existing workspace folder and add it again with a different name
     * to rename that folder.
     *
     * **Note:** it is not valid to call [updateWorkspaceFolders()](#updateWorkspaceFolders) multiple times
     * without waiting for the [`onDidChangeWorkspaceFolders()`](#onDidChangeWorkspaceFolders) to fire.
     *
     * @param start the zero-based location in the list of currently opened [workspace folders](#WorkspaceFolder)
     * from which to start deleting workspace folders.
     * @param deleteCount the optional number of workspace folders to remove.
     * @param workspaceFoldersToAdd the optional variable set of workspace folders to add in place of the deleted ones.
     * Each workspace is identified with a mandatory URI and an optional name.
     * @return true if the operation was successfully started and false otherwise if arguments were used that would result
     * in invalid workspace folder state (e.g. 2 folders with the same URI).
     */
    export function updateWorkspaceFolders(start: number, deleteCount: number | undefined | null, ...workspaceFoldersToAdd: { uri: Uri, name?: string }[]): boolean;

    /**
     * Save all dirty files.
     *
     * @param includeUntitled Also save files that have been created during this session.
     * @return A thenable that resolves when the files have been saved.
     */
    export function saveAll(includeUntitled?: boolean): Thenable<boolean>;

    /**
     * An event that is emitted when files are being created.
     *
     * *Note 1:* This event is triggered by user gestures, like creating a file from the
     * explorer, or from the [`workspace.applyEdit`](#workspace.applyEdit)-api. This event is *not* fired when
     * files change on disk, e.g triggered by another application, or when using the
     * [`workspace.fs`](#FileSystem)-api.
     *
     * *Note 2:* When this event is fired, edits to files that are are being created cannot be applied.
     */
    export const onWillCreateFiles: Event<FileWillCreateEvent>;

    /**
     * An event that is emitted when files have been created.
     *
     * *Note:* This event is triggered by user gestures, like creating a file from the
     * explorer, or from the [`workspace.applyEdit`](#workspace.applyEdit)-api, but this event is *not* fired when
     * files change on disk, e.g triggered by another application, or when using the
     * [`workspace.fs`](#FileSystem)-api.
     */
    export const onDidCreateFiles: Event<FileCreateEvent>;

    /**
     * An event that is emitted when files are being deleted.
     *
     * *Note 1:* This event is triggered by user gestures, like deleting a file from the
     * explorer, or from the [`workspace.applyEdit`](#workspace.applyEdit)-api, but this event is *not* fired when
     * files change on disk, e.g triggered by another application, or when using the
     * [`workspace.fs`](#FileSystem)-api.
     *
     * *Note 2:* When deleting a folder with children only one event is fired.
     */
    export const onWillDeleteFiles: Event<FileWillDeleteEvent>;

    /**
     * An event that is emitted when files have been deleted.
     *
     * *Note 1:* This event is triggered by user gestures, like deleting a file from the
     * explorer, or from the [`workspace.applyEdit`](#workspace.applyEdit)-api, but this event is *not* fired when
     * files change on disk, e.g triggered by another application, or when using the
     * [`workspace.fs`](#FileSystem)-api.
     *
     * *Note 2:* When deleting a folder with children only one event is fired.
     */
    export const onDidDeleteFiles: Event<FileDeleteEvent>;

    /**
     * An event that is emitted when files are being renamed.
     *
     * *Note 1:* This event is triggered by user gestures, like renaming a file from the
     * explorer, and from the [`workspace.applyEdit`](#workspace.applyEdit)-api, but this event is *not* fired when
     * files change on disk, e.g triggered by another application, or when using the
     * [`workspace.fs`](#FileSystem)-api.
     *
     * *Note 2:* When renaming a folder with children only one event is fired.
     */
    export const onWillRenameFiles: Event<FileWillRenameEvent>;

    /**
     * An event that is emitted when files have been renamed.
     *
     * *Note 1:* This event is triggered by user gestures, like renaming a file from the
     * explorer, and from the [`workspace.applyEdit`](#workspace.applyEdit)-api, but this event is *not* fired when
     * files change on disk, e.g triggered by another application, or when using the
     * [`workspace.fs`](#FileSystem)-api.
     *
     * *Note 2:* When renaming a folder with children only one event is fired.
     */
    export const onDidRenameFiles: Event<FileRenameEvent>;

  }

  /**
   * An event that is fired when files are going to be created.
   *
   * To make modifications to the workspace before the files are created,
   * call the [`waitUntil](#FileWillCreateEvent.waitUntil)-function with a
   * thenable that resolves to a [workspace edit](#WorkspaceEdit).
   */
  export interface FileWillCreateEvent {

    /**
     * A cancellation token.
     */
    readonly token: CancellationToken;

    /**
     * The files that are going to be created.
     */
    readonly files: ReadonlyArray<Uri>;

    /**
     * Allows to pause the event and to apply a [workspace edit](#WorkspaceEdit).
     *
     * *Note:* This function can only be called during event dispatch and not
     * in an asynchronous manner:
     *
     * ```ts
     * workspace.onWillCreateFiles(event => {
     *   // async, will *throw* an error
     *   setTimeout(() => event.waitUntil(promise));
     *
     *   // sync, OK
     *   event.waitUntil(promise);
     * })
     * ```
     *
     * @param thenable A thenable that delays saving.
     */
    waitUntil(thenable: Thenable<WorkspaceEdit>): void;

    /**
     * Allows to pause the event until the provided thenable resolves.
     *
     * *Note:* This function can only be called during event dispatch.
     *
     * @param thenable A thenable that delays saving.
     */
    waitUntil(thenable: Thenable<any>): void;
  }

  /**
   * An event that is fired after files are created.
   */
  export interface FileCreateEvent {

    /**
     * The files that got created.
     */
    readonly files: ReadonlyArray<Uri>;
  }

  /**
   * An event that is fired when files are going to be deleted.
   *
   * To make modifications to the workspace before the files are deleted,
   * call the [`waitUntil](#FileWillCreateEvent.waitUntil)-function with a
   * thenable that resolves to a [workspace edit](#WorkspaceEdit).
   */
  export interface FileWillDeleteEvent {
    /**
     * A cancellation token.
     */
    readonly token: CancellationToken;

    /**
     * The files that are going to be deleted.
     */
    readonly files: ReadonlyArray<Uri>;

    /**
     * Allows to pause the event and to apply a [workspace edit](#WorkspaceEdit).
     *
     * *Note:* This function can only be called during event dispatch and not
     * in an asynchronous manner:
     *
     * ```ts
     * workspace.onWillCreateFiles(event => {
     *   // async, will *throw* an error
     *   setTimeout(() => event.waitUntil(promise));
     *
     *   // sync, OK
     *   event.waitUntil(promise);
     * })
     * ```
     *
     * @param thenable A thenable that delays saving.
     */
    waitUntil(thenable: Thenable<WorkspaceEdit>): void;

    /**
     * Allows to pause the event until the provided thenable resolves.
     *
     * *Note:* This function can only be called during event dispatch.
     *
     * @param thenable A thenable that delays saving.
     */
    waitUntil(thenable: Thenable<any>): void;
  }

  /**
   * An event that is fired after files are deleted.
   */
  export interface FileDeleteEvent {

    /**
     * The files that got deleted.
     */
    readonly files: ReadonlyArray<Uri>;
  }

  /**
   * An event that is fired when files are going to be renamed.
   *
   * To make modifications to the workspace before the files are renamed,
   * call the [`waitUntil](#FileWillCreateEvent.waitUntil)-function with a
   * thenable that resolves to a [workspace edit](#WorkspaceEdit).
   */
  export interface FileWillRenameEvent {
    /**
     * A cancellation token.
     */
    readonly token: CancellationToken;

    /**
     * The files that are going to be renamed.
     */
    readonly files: ReadonlyArray<{ oldUri: Uri, newUri: Uri }>;

    /**
     * Allows to pause the event and to apply a [workspace edit](#WorkspaceEdit).
     *
     * *Note:* This function can only be called during event dispatch and not
     * in an asynchronous manner:
     *
     * ```ts
     * workspace.onWillCreateFiles(event => {
     *   // async, will *throw* an error
     *   setTimeout(() => event.waitUntil(promise));
     *
     *   // sync, OK
     *   event.waitUntil(promise);
     * })
     * ```
     *
     * @param thenable A thenable that delays saving.
     */
    waitUntil(thenable: Thenable<WorkspaceEdit>): void;

    /**
     * Allows to pause the event until the provided thenable resolves.
     *
     * *Note:* This function can only be called during event dispatch.
     *
     * @param thenable A thenable that delays saving.
     */
    waitUntil(thenable: Thenable<any>): void;
  }

  /**
   * An event that is fired after files are renamed.
   */
  export interface FileRenameEvent {

    /**
     * The files that got renamed.
     */
    readonly files: ReadonlyArray<{ oldUri: Uri, newUri: Uri }>;
  }
}

import type { TextDocument } from 'vscode';

import { Event, BasicEvent, URI, IExtensionInfo } from '@opensumi/ide-core-common';
import type { CancellationToken } from '@opensumi/ide-core-common/lib/cancellation';

import { Uri, UriComponents } from './ext-types';
import type { WebviewPanel, IWebviewPanelOptions } from './webview';


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
  resolveCustomTextEditor(
    document: TextDocument,
    webviewPanel: WebviewPanel,
    token: CancellationToken,
  ): Thenable<void> | void;
}

/**
 * Represents a custom document used by a [`CustomEditorProvider`](#CustomEditorProvider).
 *
 * Custom documents are only used within a given `CustomEditorProvider`. The lifecycle of a `CustomDocument` is
 * managed by VS Code. When no more references remain to a `CustomDocument`, it is disposed of.
 */
export interface CustomDocument {
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
export interface CustomDocumentEditEvent<T extends CustomDocument = CustomDocument> {
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
export interface CustomDocumentContentChangeEvent<T extends CustomDocument = CustomDocument> {
  /**
   * The document that the change is for.
   */
  readonly document: T;
}

/**
 * A backup for an [`CustomDocument`](#CustomDocument).
 */
export interface CustomDocumentBackup {
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
export interface CustomDocumentBackupContext {
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
export interface CustomDocumentOpenContext {
  /**
   * The id of the backup to restore the document from or `undefined` if there is no backup.
   *
   * If this is provided, your extension should restore the editor from the backup instead of reading the file
   * from the user's workspace.
   */
  readonly backupId?: string;
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
export interface CustomEditorProvider<T extends CustomDocument = CustomDocument>
  extends CustomReadonlyEditorProvider<T> {
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
  readonly onDidChangeCustomDocument: Event<CustomDocumentEditEvent<T> | CustomDocumentContentChangeEvent<T>>;

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
}

export interface ICustomEditorSelector {
  filenamePattern: string;
}

export interface CustomEditorScheme {
  viewType: string;
  displayName: string;
  selector: ICustomEditorSelector[];
  priority?: 'default' | 'option';
}

export class CustomEditorShouldDisplayEvent extends BasicEvent<{
  uri: URI;
  viewType: string;
  openTypeId: string;
  webviewPanelId: string;
  cancellationToken: CancellationToken;
}> {}

export class CustomEditorShouldHideEvent extends BasicEvent<{
  uri: URI;
  viewType: string;
}> {}

export class CustomEditorShouldSaveEvent extends BasicEvent<{
  uri: URI;
  viewType: string;
  cancellationToken: CancellationToken;
}> {}

export class CustomEditorShouldRevertEvent extends BasicEvent<{
  uri: URI;
  viewType: string;
  cancellationToken: CancellationToken;
}> {}

export class CustomEditorShouldEditEvent extends BasicEvent<{
  type: 'redo' | 'undo';
  uri: URI;
  viewType: string;
}> {}

export class CustomEditorOptionChangeEvent extends BasicEvent<{
  viewType: string;
  options: ICustomEditorOptions;
}> {}

export interface IExtHostCustomEditor {
  $resolveCustomTextEditor(viewType: string, uri: UriComponents, webviewPanelId: string, token: CancellationToken);

  $saveCustomDocument(viewType: string, uri: UriComponents, token: CancellationToken);

  $revertCustomDocument(viewType: string, uri: UriComponents, token: CancellationToken);

  $undo(viewType: string, uri: UriComponents);

  $redo(viewType: string, uri: UriComponents);
}

export enum CustomEditorType {
  TextEditor = 1,
  ReadonlyEditor = 2,
  FullEditor = 3,
}

export interface ICustomEditorOptions {
  supportsMultipleEditorsPerDocument?: boolean;
  webviewOptions?: IWebviewPanelOptions;
}

export interface IMainThreadCustomEditor {
  $registerCustomEditor(
    viewType: string,
    editorType: CustomEditorType,
    options: ICustomEditorOptions,
    extensionInfo: IExtensionInfo,
  );

  $acceptCustomDocumentDirty(uri: UriComponents, dirty: boolean);
  //
  $unregisterCustomEditor(viewType: string);
}

export type TCustomEditorProvider =
  | {
      type: CustomEditorType.FullEditor;
      provider: CustomEditorProvider;
    }
  | {
      type: CustomEditorType.ReadonlyEditor;
      provider: CustomReadonlyEditorProvider;
    }
  | {
      type: CustomEditorType.TextEditor;
      provider: CustomTextEditorProvider;
    };

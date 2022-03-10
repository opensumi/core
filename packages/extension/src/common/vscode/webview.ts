import type vscode from 'vscode';

import { Event, IExtensionInfo, Uri, CancellationToken, BasicEvent } from '@opensumi/ide-core-common';

import { ViewColumn } from './editor';

export interface WebviewPanelShowOptions {
  readonly viewColumn?: number;
  readonly preserveFocus?: boolean;
}

export interface IWebviewPanelOptions {
  readonly enableFindWidget?: boolean;
  readonly retainContextWhenHidden?: boolean;
}

export interface IWebviewOptions {
  readonly enableScripts?: boolean;
  readonly enableForms?: boolean;
  readonly enableCommandUris?: boolean;
  readonly localResourceRoots?: ReadonlyArray<vscode.Uri>;
}

export interface IWebviewPanelViewState {
  active: boolean;
  visible: boolean;
  position: number; // view column
}

export interface IMainThreadWebview {
  $getWebviewResourceRoots(): Promise<string[]>;

  $createWebviewPanel(
    id: string,
    viewType: string,
    title: string,
    showOptions: WebviewPanelShowOptions,
    options: IWebviewPanelOptions & IWebviewOptions,
    extensionInfo: IExtensionInfo,
  ): void;
  $disposeWebview(id: string): void;
  $reveal(id: string, showOptions: WebviewPanelShowOptions): void;
  $setTitle(id: string, value: string): void;
  $setIconPath(id: string, value?: { light: string; dark: string; hc: string } | string): void;

  $setHtml(id: string, value: string): void;
  $setOptions(id: string, options: IWebviewOptions): void;
  $postMessage(id: string, value: any): Promise<boolean>;

  $registerSerializer(viewType: string): void;
  $unregisterSerializer(viewType: string): void;

  $connectPlainWebview(id: string);
  $postMessageToPlainWebview(id: string, value: any): Promise<boolean>;
  $createPlainWebview(id: string, title: string, iconPath?: string): Promise<void>;
  $plainWebviewLoadUrl(id: string, uri: string): Promise<void>;
  $disposePlainWebview(id: string): Promise<void>;
  $revealPlainWebview(id: string, groupIndex: number): Promise<void>;
}

export interface IWebviewExtensionDescription {
  readonly id: string;
}

export type WebviewHandle = string;

export interface IMainThreadWebviewView {
  $registerWebviewViewProvider(
    extension: IWebviewExtensionDescription,
    viewType: string,
    options?: { retainContextWhenHidden?: boolean },
  ): void;
  $unregisterWebviewViewProvider(viewType: string): void;

  $setWebviewViewTitle(handle: WebviewHandle, value: string | undefined): void;
  $setWebviewViewDescription(handle: WebviewHandle, value: string | undefined): void;

  $show(handle: WebviewHandle, preserveFocus: boolean): void;
}

export interface IExtHostWebviewView {
  $resolveWebviewView(
    webviewHandle: WebviewHandle,
    viewType: string,
    title: string | undefined,
    state: any,
    cancellation: CancellationToken,
  ): Promise<void>;

  $onDidChangeWebviewViewVisibility(webviewHandle: WebviewHandle, visible: boolean): void;

  $disposeWebviewView(webviewHandle: WebviewHandle): void;
}

export interface IExtHostWebview {
  $init(): void;
  $onMessage(id: string, message: any): void;
  $onDidChangeWebviewPanelViewState(id: string, newState: IWebviewPanelViewState): void;
  $onDidDisposeWebviewPanel(id: string): Promise<void>;
  $deserializeWebviewPanel(
    newWebviewId: string,
    viewType: string,
    title: string,
    state: any,
    position: number,
    options: IWebviewOptions,
  ): Promise<void>;

  /**
   * browser主动创建了一个webview，把它交给 exthost 创建 webviewPanel
   * @param id
   */
  $pipeBrowserHostedWebviewPanel(id: string, viewType: string): void;
}

export interface Webview {
  /**
   * Content settings for the webview.
   */
  options: IWebviewOptions;

  /**
   * Contents of the webview.
   *
   * Should be a complete html document.
   */
  html: string;

  /**
   * Fired when the webview content posts a message.
   */
  readonly onDidReceiveMessage: Event<any>;

  /**
   * Post a message to the webview content.
   *
   * Messages are only delivered if the webview is visible.
   *
   * @param message Body of the message.
   */
  postMessage(message: any): Thenable<boolean>;

  /**
   * Convert a uri for the local file system to one that can be used inside webviews.
   *
   * Webviews cannot directly load resources from the workspace or local file system using `file:` uris. The
   * `asWebviewUri` function takes a local `file:` uri and converts it into a uri that can be used inside of
   * a webview to load the same resource:
   *
   * ```ts
   * webview.html = `<img src="${webview.asWebviewUri(vscode.Uri.file('/Users/codey/workspace/cat.gif'))}">`
   * ```
   */
  asWebviewUri(localResource: Uri): Uri;

  /**
   * Content security policy source for webview resources.
   *
   * This is the origin that should be used in a content security policy rule:
   *
   * ```
   * img-src https: ${webview.cspSource} ...;
   * ```
   */
  readonly cspSource: string;
}

export interface WebviewPanel {
  /**
   * Identifies the type of the webview panel, such as `'markdown.preview'`.
   */
  readonly viewType: string;

  /**
   * Title of the panel shown in UI.
   */
  title: string;

  /**
   * Icon for the panel shown in UI.
   */
  iconPath?: Uri | { light: Uri; dark: Uri };

  /**
   * Webview belonging to the panel.
   */
  readonly webview: Webview;

  /**
   * Content settings for the webview panel.
   */
  readonly options: IWebviewPanelOptions;

  /**
   * Editor position of the panel. This property is only set if the webview is in
   * one of the editor view columns.
   */
  readonly viewColumn?: ViewColumn;

  /**
   * Whether the panel is active (focused by the user).
   */
  readonly active: boolean;

  /**
   * Whether the panel is visible.
   */
  readonly visible: boolean;

  /**
   * Fired when the panel's view state changes.
   */
  readonly onDidChangeViewState: Event<WebviewPanelOnDidChangeViewStateEvent>;

  /**
   * Fired when the panel is disposed.
   *
   * This may be because the user closed the panel or because `.dispose()` was
   * called on it.
   *
   * Trying to use the panel after it has been disposed throws an exception.
   */
  readonly onDidDispose: Event<void>;

  /**
   * Show the webview panel in a given column.
   *
   * A webview panel may only show in a single column at a time. If it is already showing, this
   * method moves it to a new column.
   *
   * @param viewColumn View column to show the panel in. Shows in the current `viewColumn` if undefined.
   * @param preserveFocus When `true`, the webview will not take focus.
   */
  reveal(viewColumn?: ViewColumn, preserveFocus?: boolean): void;

  /**
   * Dispose of the webview panel.
   *
   * This closes the panel if it showing and disposes of the resources owned by the webview.
   * Webview panels are also disposed when the user closes the webview panel. Both cases
   * fire the `onDispose` event.
   */
  dispose(): any;
}

/**
 * Event fired when a webview panel's view state changes.
 */
export interface WebviewPanelOnDidChangeViewStateEvent {
  /**
   * Webview panel whose view state changed.
   */
  readonly webviewPanel: WebviewPanel;
}

export interface WebviewPanelSerializer {
  /**
   * Restore a webview panel from its seriailzed `state`.
   *
   * Called when a serialized webview first becomes visible.
   *
   * @param webviewPanel Webview panel to restore. The serializer should take ownership of this panel. The
   * serializer must restore the webview's `.html` and hook up all webview events.
   * @param state Persisted state from the webview content.
   *
   * @return Thanble indicating that the webview has been fully restored.
   */
  deserializeWebviewPanel(webviewPanel: WebviewPanel, state: any): Thenable<void>;
}

/**
 * A webview based view.
 */
export interface WebviewView {
  /**
   * Identifies the type of the webview view, such as `'hexEditor.dataView'`.
   */
  readonly viewType: string;

  /**
   * The underlying webview for the view.
   */
  readonly webview: Webview;

  /**
   * View title displayed in the UI.
   *
   * The view title is initially taken from the extension `package.json` contribution.
   */
  title?: string;

  /**
   * Human-readable string which is rendered less prominently in the title.
   */
  description?: string;

  /**
   * Event fired when the view is disposed.
   *
   * Views are disposed when they are explicitly hidden by a user (this happens when a user
   * right clicks in a view and unchecks the webview view).
   *
   * Trying to use the view after it has been disposed throws an exception.
   */
  readonly onDidDispose: Event<void>;

  /**
   * Tracks if the webview is currently visible.
   *
   * Views are visible when they are on the screen and expanded.
   */
  readonly visible: boolean;

  /**
   * Event fired when the visibility of the view changes.
   *
   * Actions that trigger a visibility change:
   *
   * - The view is collapsed or expanded.
   * - The user switches to a different view group in the sidebar or panel.
   *
   * Note that hiding a view using the context menu instead disposes of the view and fires `onDidDispose`.
   */
  readonly onDidChangeVisibility: Event<void>;

  /**
   * Reveal the view in the UI.
   *
   * If the view is collapsed, this will expand it.
   *
   * @param preserveFocus When `true` the view will not take focus.
   */
  show(preserveFocus?: boolean): void;
}

/**
 * Additional information the webview view being resolved.
 *
 * @param T Type of the webview's state.
 */
interface WebviewViewResolveContext<T = unknown> {
  /**
   * Persisted state from the webview content.
   *
   * To save resources, VS Code normally deallocates webview documents (the iframe content) that are not visible.
   * For example, when the user collapse a view or switches to another top level activity in the sidebar, the
   * `WebviewView` itself is kept alive but the webview's underlying document is deallocated. It is recreated when
   * the view becomes visible again.
   *
   * You can prevent this behavior by setting `retainContextWhenHidden` in the `WebviewOptions`. However this
   * increases resource usage and should be avoided wherever possible. Instead, you can use persisted state to
   * save off a webview's state so that it can be quickly recreated as needed.
   *
   * To save off a persisted state, inside the webview call `acquireVsCodeApi().setState()` with
   * any json serializable object. To restore the state again, call `getState()`. For example:
   *
   * ```js
   * // Within the webview
   * const vscode = acquireVsCodeApi();
   *
   * // Get existing state
   * const oldState = vscode.getState() || { value: 0 };
   *
   * // Update state
   * setState({ value: oldState.value + 1 })
   * ```
   *
   * VS Code ensures that the persisted state is saved correctly when a webview is hidden and across
   * editor restarts.
   */
  readonly state: T | undefined;
}

/**
 * Provider for creating `WebviewView` elements.
 */
export interface WebviewViewProvider {
  /**
   * Revolves a webview view.
   *
   * `resolveWebviewView` is called when a view first becomes visible. This may happen when the view is
   * first loaded or when the user hides and then shows a view again.
   *
   * @param webviewView Webview view to restore. The provider should take ownership of this view. The
   *    provider must set the webview's `.html` and hook up all webview events it is interested in.
   * @param context Additional metadata about the view being resolved.
   * @param token Cancellation token indicating that the view being provided is no longer needed.
   *
   * @return Optional thenable indicating that the view has been fully resolved.
   */
  resolveWebviewView(
    webviewView: WebviewView,
    context: WebviewViewResolveContext,
    token: CancellationToken,
  ): Thenable<void> | void;
}

export interface WebviewViewOptions {
  retainContextWhenHidden?: boolean | undefined;
}

export class WebviewViewResolverRegistrationEvent extends BasicEvent<{
  viewType: string;
  options: WebviewViewOptions;
}> {}

export class WebviewViewResolverRegistrationRemovalEvent extends BasicEvent<{
  viewType: string;
}> {}

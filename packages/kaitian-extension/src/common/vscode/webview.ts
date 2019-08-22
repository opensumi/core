import { UriComponents, Uri } from './ext-types';
import { URI, Event } from '@ali/ide-core-common';
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
  readonly enableCommandUris?: boolean;
  readonly localResourceRoots?: ReadonlyArray<URI>; // TODO 资源文件处理
  // TODO readonly portMapping?: ReadonlyArray<IWebviewPortMapping>;
}

export interface IWebviewPanelViewState {
  active: boolean;
   visible: boolean;
  position: number; // view column
}

export interface IMainThreadWebview {
  $createWebviewPanel(id: string, viewType: string, title: string, showOptions: WebviewPanelShowOptions, options: IWebviewPanelOptions & IWebviewOptions): void;
  $disposeWebview(id: string): void;
  $reveal(id: string, showOptions: WebviewPanelShowOptions): void;
  $setTitle(id: string, value: string): void;
  $setIconPath(id: string, value: { light: UriComponents, dark: UriComponents } | undefined): void;

  $setHtml(id: string, value: string): void;
  $setOptions(id: string, options: IWebviewOptions): void;
  $postMessage(id: string, value: any): Promise<boolean>;

  $registerSerializer(viewType: string): void;
  $unregisterSerializer(viewType: string): void;
}

export interface IExtHostWebview {
  $onMessage(id: string, message: any): void;
  $onDidChangeWebviewPanelViewState(id: string, newState: IWebviewPanelViewState): void;
  $onDidDisposeWebviewPanel(id: string): Promise<void>;
  $deserializeWebviewPanel(newWebviewId: string, viewType: string, title: string, state: any, position: number, options: IWebviewOptions): Promise<void>;
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

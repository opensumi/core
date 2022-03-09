/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * This is the place for API experiments and proposals.
 * These API are NOT stable and subject to change. They are only available in the Insiders
 * distribution and CANNOT be used in published extensions.
 *
 * To test these API in local environment:
 * - Use Insiders release of VS Code.
 * - Add `"enableProposedApi": true` to your package.json.
 * - Copy this file to your project.
 */

declare module 'vscode' {

  //#region Joao: diff command

  /**
   * The contiguous set of modified lines in a diff.
   */
  export interface LineChange {
    readonly originalStartLineNumber: number;
    readonly originalEndLineNumber: number;
    readonly modifiedStartLineNumber: number;
    readonly modifiedEndLineNumber: number;
  }


  export namespace commands {

    /**
     * Registers a diff information command that can be invoked via a keyboard shortcut,
     * a menu item, an action, or directly.
     *
     * Diff information commands are different from ordinary [commands](#commands.registerCommand) as
     * they only execute when there is an active diff editor when the command is called, and the diff
     * information has been computed. Also, the command handler of an editor command has access to
     * the diff information.
     *
     * @param command A unique identifier for the command.
     * @param callback A command handler function with access to the [diff information](#LineChange).
     * @param thisArg The `this` context used when invoking the handler function.
     * @return Disposable which unregisters this command on disposal.
     */
    export function registerDiffInformationCommand(command: string, callback: (diff: LineChange[], ...args: any[]) => any, thisArg?: any): Disposable;
  }

  //#region Joao: SCM validation

  //#region Rob, Matt: logging

  /**
   * The severity level of a log message
   */
  export enum LogLevel {
    Trace = 1,
    Debug = 2,
    Info = 3,
    Warning = 4,
    Error = 5,
    Critical = 6,
    Off = 7
  }

  export namespace env {
    /**
     * Current logging level.
     */
    export const logLevel: LogLevel;

    /**
     * An [event](#Event) that fires when the log level has changed.
     */
    export const onDidChangeLogLevel: Event<LogLevel>;
  }

  //#endregion

  /**
   * Represents the validation type of the Source Control input.
   */
  export enum SourceControlInputBoxValidationType {

    /**
     * Something not allowed by the rules of a language or other means.
     */
    Error = 0,

    /**
     * Something suspicious but allowed.
     */
    Warning = 1,

    /**
     * Something to inform about but not a problem.
     */
    Information = 2
  }

  export interface SourceControlInputBoxValidation {

    /**
     * The validation message to display.
     */
    readonly message: string;

    /**
     * The validation type.
     */
    readonly type: SourceControlInputBoxValidationType;
  }

  /**
   * Represents the input box in the Source Control viewlet.
   */
  export interface SourceControlInputBox {

    /**
     * A validation function for the input box. It's possible to change
     * the validation provider simply by setting this property to a different function.
     */
    validateInput?(value: string, cursorPosition: number): ProviderResult<SourceControlInputBoxValidation | undefined | null>;
  }

  //#endregion

  //#region Joao: SCM selected provider

  export interface SourceControl {

    /**
     * Whether the source control is selected.
     */
    readonly selected: boolean;

    /**
     * An event signaling when the selection state changes.
     */
    readonly onDidChangeSelection: Event<boolean>;
  }

  //#endregion

  //#region Joao: SCM Input Box

  /**
   * Represents the input box in the Source Control viewlet.
   */
  export interface SourceControlInputBox {

    /**
      * Controls whether the input box is visible (default is `true`).
      */
    visible: boolean;
  }

  //#endregion

  //#region Joh: decorations

  //#region old file-decorations
  export interface SourceControlResourceDecorations {
    source?: string;
    letter?: string;
    color?: ThemeColor;
  }


  /**
   * @deprecated
   * please use `FileDecoration`
   */
  export class Decoration {
    letter?: string;
    title?: string;
    color?: ThemeColor;
    priority?: number;
    bubble?: boolean;
    source?: string; // hacky... we should remove it and use equality under the hood
  }

  /**
   * @deprecated
   * please use `FileDecorationProvider`
   */

  export interface DecorationProvider {
    onDidChangeDecorations: Event<undefined | Uri | Uri[]>;
    provideDecoration(uri: Uri, token: CancellationToken): ProviderResult<Decoration>;
  }

  export namespace window {
    /**
     * @deprecated
     * please use `registerDecorationProvider`
     */
    export function registerDecorationProvider(provider: DecorationProvider): Disposable;
  }

  //#endregion

  //#region file-decorations: https://github.com/microsoft/vscode/issues/54938
  /**
   * A file decoration represents metadata that can be rendered with a file.
   */
  export class FileDecoration {

    /**
     * A very short string that represents this decoration.
     */
    badge?: string;

    /**
     * A human-readable tooltip for this decoration.
     */
    tooltip?: string;

    /**
     * The color of this decoration.
     */
    color?: ThemeColor;

    /**
     * A flag expressing that this decoration should be
     * propagated to its parents.
     */
    propagate?: boolean;

    /**
     * Creates a new decoration.
     *
     * @param badge A letter that represents the decoration.
     * @param tooltip The tooltip of the decoration.
     * @param color The color of the decoration.
     */
    constructor(badge?: string, tooltip?: string, color?: ThemeColor);
  }

  /**
   * The decoration provider interfaces defines the contract between extensions and
   * file decorations.
   */
  export interface FileDecorationProvider {

    /**
     * An optional event to signal that decorations for one or many files have changed.
     *
     * *Note* that this event should be used to propagate information about children.
     *
     * @see {@link EventEmitter}
     */
    onDidChange: Event<undefined | Uri | Uri[]>;

    /**
     * An optional event to signal that decorations for one or many files have changed.
     *
     * *Note* that this event should be used to propagate information about children.
     *
     * @see [EventEmitter](#EventEmitter)
     */
    onDidChangeFileDecorations?: Event<undefined | Uri | Uri[]>;

    /**
     * Provide decorations for a given uri.
     *
     * *Note* that this function is only called when a file gets rendered in the UI.
     * This means a decoration from a descendent that propagates upwards must be signaled
     * to the editor via the {@link FileDecorationProvider.onDidChangeFileDecorations onDidChangeFileDecorations}-event.
     *
     * @param uri The uri of the file to provide a decoration for.
     * @param token A cancellation token.
     * @returns A decoration or a thenable that resolves to such.
     */
    provideFileDecoration(uri: Uri, token: CancellationToken): ProviderResult<FileDecoration>;
  }

  export namespace window {
    /**
     * Register a file decoration provider.
     *
     * @param provider A {@link FileDecorationProvider}.
     * @return A {@link Disposable} that unregisters the provider.
     */
    export function registerFileDecorationProvider(provider: FileDecorationProvider): Disposable;
  }

  //#endregion

  /**
   * An [event](#Event) which fires when a [Terminal](#Terminal)'s dimensions change.
   */
  export interface TerminalDimensionsChangeEvent {
    /**
     * The [terminal](#Terminal) for which the dimensions have changed.
     */
    readonly terminal: Terminal;
    /**
     * The new value for the [terminal's dimensions](#Terminal.dimensions).
     */
    readonly dimensions: TerminalDimensions;
  }

  //#endregion

  /**
   * Label describing the [Tree item](#TreeItem)
   */
  export interface TreeItemLabel {

    /**
     * A human-readable string describing the [Tree item](#TreeItem).
     */
    label: string;

    /**
     * Ranges in the label to highlight. A range is defined as a tuple of two number where the
     * first is the inclusive start index and the second the exclusive end index
     */
    highlights?: [number, number][];

  }
  //#endregion

  /**
   * A task to execute
   */
  export class Task2 extends Task {
    detail?: string;
  }
  //#endregion

  //#region Tasks
  export interface TaskPresentationOptions {
    /**
     * Controls whether the task is executed in a specific terminal group using split panes.
     */
    group?: string;
  }
  //#endregion

  // #region Ben - status bar item with ID and Name


  /**
   * Represents the dimensions of a terminal.
   */
  export interface TerminalDimensions {
    /**
     * The number of columns in the terminal.
     */
    readonly columns: number;

    /**
     * The number of rows in the terminal.
     */
    readonly rows: number;
  }

  /**
  /**
   * Represents a terminal without a process where all interaction and output in the terminal is
   * controlled by an extension. This is similar to an output window but has the same VT sequence
   * compatibility as the regular terminal.
   *
   * Note that an instance of [Terminal](#Terminal) will be created when a TerminalRenderer is
   * created with all its APIs available for use by extensions. When using the Terminal object
   * of a TerminalRenderer it acts just like normal only the extension that created the
   * TerminalRenderer essentially acts as a process. For example when an
   * [Terminal.onDidWriteData](#Terminal.onDidWriteData) listener is registered, that will fire
   * when [TerminalRenderer.write](#TerminalRenderer.write) is called. Similarly when
   * [Terminal.sendText](#Terminal.sendText) is triggered that will fire the
   * [TerminalRenderer.onDidAcceptInput](#TerminalRenderer.onDidAcceptInput) event.
   *
   * @deprecated Use [ExtensionTerminalOptions](#ExtensionTerminalOptions) instead.
   *
   * **Example:** Create a terminal renderer, show it and write hello world in red
   * ```typescript
   * const renderer = window.createTerminalRenderer('foo');
   * renderer.terminal.then(t => t.show());
   * renderer.write('\x1b[31mHello world\x1b[0m');
   * ```
   */
  export interface TerminalRenderer {
    /**
     * The name of the terminal, this will appear in the terminal selector.
     * @deprecated Use [ExtensionTerminalOptions](#ExtensionTerminalOptions) instead.
     */
    name: string;

    /**
     * The dimensions of the terminal, the rows and columns of the terminal can only be set to
     * a value smaller than the maximum value, if this is undefined the terminal will auto fit
     * to the maximum value [maximumDimensions](TerminalRenderer.maximumDimensions).
     *
     * @deprecated Use [ExtensionTerminalOptions](#ExtensionTerminalOptions) instead.
     *
     * **Example:** Override the dimensions of a TerminalRenderer to 20 columns and 10 rows
     * ```typescript
     * terminalRenderer.dimensions = {
     *   cols: 20,
     *   rows: 10
     * };
     * ```
     */
    dimensions: TerminalDimensions | undefined;

    /**
     * The maximum dimensions of the terminal, this will be undefined immediately after a
     * terminal renderer is created and also until the terminal becomes visible in the UI.
     * Listen to [onDidChangeMaximumDimensions](TerminalRenderer.onDidChangeMaximumDimensions)
     * to get notified when this value changes.
     *
     * @deprecated Use [ExtensionTerminalOptions](#ExtensionTerminalOptions) instead.
     */
    readonly maximumDimensions: TerminalDimensions | undefined;

    /**
     * The corresponding [Terminal](#Terminal) for this TerminalRenderer.
     *
     * @deprecated Use [ExtensionTerminalOptions](#ExtensionTerminalOptions) instead.
     */
    readonly terminal: Terminal;

    /**
     * Write text to the terminal. Unlike [Terminal.sendText](#Terminal.sendText) which sends
     * text to the underlying _process_, this will write the text to the terminal itself.
     *
     * @param text The text to write.
     * @deprecated Use [ExtensionTerminalOptions](#ExtensionTerminalOptions) instead.
     *
     * **Example:** Write red text to the terminal
     * ```typescript
     * terminalRenderer.write('\x1b[31mHello world\x1b[0m');
     * ```
     *
     * **Example:** Move the cursor to the 10th row and 20th column and write an asterisk
     * ```typescript
     * terminalRenderer.write('\x1b[10;20H*');
     * ```
     */
    write(text: string): void;

    /**
     * An event which fires on keystrokes in the terminal or when an extension calls
     * [Terminal.sendText](#Terminal.sendText). Keystrokes are converted into their
     * corresponding VT sequence representation.
     *
     * @deprecated Use [ExtensionTerminalOptions](#ExtensionTerminalOptions) instead.
     *
     * **Example:** Simulate interaction with the terminal from an outside extension or a
     * workbench command such as `workbench.action.terminal.runSelectedText`
     * ```typescript
     * const terminalRenderer = window.createTerminalRenderer('test');
     * terminalRenderer.onDidAcceptInput(data => {
     *   console.log(data); // 'Hello world'
     * });
     * terminalRenderer.terminal.sendText('Hello world');
     * ```
     */
    readonly onDidAcceptInput: Event<string>;

    /**
     * An event which fires when the [maximum dimensions](#TerminalRenderer.maximumDimensions) of
     * the terminal renderer change.
     *
     * @deprecated Use [ExtensionTerminalOptions](#ExtensionTerminalOptions) instead.
     */
    readonly onDidChangeMaximumDimensions: Event<TerminalDimensions>;
  }

  //#region eamodio - timeline: https://github.com/microsoft/vscode/issues/84297
  export class TimelineItem {
    /**
     * A timestamp (in milliseconds since 1 January 1970 00:00:00) for when the timeline item occurred.
     */
    timestamp: number;

    /**
     * A human-readable string describing the timeline item.
     */
    label: string;

    /**
     * Optional id for the timeline item. It must be unique across all the timeline items provided by this source.
     *
     * If not provided, an id is generated using the timeline item's timestamp.
     */
    id?: string;

    /**
     * The icon path or [ThemeIcon](#ThemeIcon) for the timeline item.
     */
    iconPath?: Uri | { light: Uri; dark: Uri } | ThemeIcon;

    /**
     * A human readable string describing less prominent details of the timeline item.
     */
    description?: string;

    /**
     * The tooltip text when you hover over the timeline item.
     */
    detail?: string;

    /**
     * The [command](#Command) that should be executed when the timeline item is selected.
     */
    command?: Command;

    /**
     * Context value of the timeline item. This can be used to contribute specific actions to the item.
     * For example, a timeline item is given a context value as `commit`. When contributing actions to `timeline/item/context`
     * using `menus` extension point, you can specify context value for key `timelineItem` in `when` expression like `timelineItem == commit`.
     * ```
     *  "contributes": {
     *    "menus": {
     *      "timeline/item/context": [
     *        {
     *          "command": "extension.copyCommitId",
     *          "when": "timelineItem == commit"
     *        }
     *      ]
     *    }
     *  }
     * ```
     * This will show the `extension.copyCommitId` action only for items where `contextValue` is `commit`.
     */
    contextValue?: string;

    /**
     * @param label A human-readable string describing the timeline item
     * @param timestamp A timestamp (in milliseconds since 1 January 1970 00:00:00) for when the timeline item occurred
     */
    constructor(label: string, timestamp: number);
  }
  //#endregion
  //#region auth provider: https://github.com/microsoft/vscode/issues/88309

  /**
   * An {@link Event} which fires when an {@link AuthenticationProvider} is added or removed.
   */
  export interface AuthenticationProvidersChangeEvent {
    /**
     * The ids of the {@link AuthenticationProvider}s that have been added.
     */
    readonly added: ReadonlyArray<AuthenticationProviderInformation>;

    /**
     * The ids of the {@link AuthenticationProvider}s that have been removed.
     */
    readonly removed: ReadonlyArray<AuthenticationProviderInformation>;
  }

  export namespace authentication {
    /**
     * @deprecated - getSession should now trigger extension activation.
     * Fires with the provider id that was registered or unregistered.
     */
    export const onDidChangeAuthenticationProviders: Event<AuthenticationProvidersChangeEvent>;

    /**
     * @deprecated
     * An array of the information of authentication providers that are currently registered.
     */
    export const providers: ReadonlyArray<AuthenticationProviderInformation>;

    /**
     * @deprecated
     * Logout of a specific session.
     * @param providerId The id of the provider to use
     * @param sessionId The session id to remove
     * provider
     */
    export function logout(providerId: string, sessionId: string): Thenable<void>;
  }

  //#endregion

  //#region https://github.com/microsoft/vscode/issues/16221

  // todo@API Split between Inlay- and OverlayHints (InlayHint are for a position, OverlayHints for a non-empty range)
  // todo@API add "mini-markdown" for links and styles
  // (done) remove description
  // (done) rename to InlayHint
  // (done)  add InlayHintKind with type, argument, etc

  export namespace languages {
    /**
     * Register a inlay hints provider.
     *
     * Multiple providers can be registered for a language. In that case providers are asked in
     * parallel and the results are merged. A failing provider (rejected promise or exception) will
     * not cause a failure of the whole operation.
     *
     * @param selector A selector that defines the documents this provider is applicable to.
     * @param provider An inlay hints provider.
     * @return A {@link Disposable} that unregisters this provider when being disposed.
     */
    export function registerInlayHintsProvider(selector: DocumentSelector, provider: InlayHintsProvider): Disposable;
  }

  export enum InlayHintKind {
    Other = 0,
    Type = 1,
    Parameter = 2,
  }

  /**
   * Inlay hint information.
   */
  export class InlayHint {
    /**
     * The text of the hint.
     */
    text: string;
    /**
     * The position of this hint.
     */
    position: Position;
    /**
     * The kind of this hint.
     */
    kind?: InlayHintKind;
    /**
     * Whitespace before the hint.
     */
    whitespaceBefore?: boolean;
    /**
     * Whitespace after the hint.
     */
    whitespaceAfter?: boolean;

    // todo@API make range first argument
    constructor(text: string, position: Position, kind?: InlayHintKind);
  }

  /**
   * The inlay hints provider interface defines the contract between extensions and
   * the inlay hints feature.
   */
  export interface InlayHintsProvider {

    /**
     * An optional event to signal that inlay hints have changed.
     * @see {@link EventEmitter}
     */
    onDidChangeInlayHints?: Event<void>;

    /**
     *
     * @param model The document in which the command was invoked.
     * @param range The range for which inlay hints should be computed.
     * @param token A cancellation token.
     * @return A list of inlay hints or a thenable that resolves to such.
     */
    provideInlayHints(model: TextDocument, range: Range, token: CancellationToken): ProviderResult<InlayHint[]>;
  }
  //#endregion

  //#region https://github.com/Microsoft/vscode/issues/15178

  // TODO@API must be a class
  export interface OpenEditorInfo {
    name: string;
    resource: Uri;
    isActive: boolean;
  }

  export namespace window {
    export const openEditors: ReadonlyArray<OpenEditorInfo>;

    // todo@API proper event type
    export const onDidChangeOpenEditors: Event<void>;
  }

  //#endregion
}

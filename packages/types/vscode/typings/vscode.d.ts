declare module 'vscode' {

  /**
   * Accessibility information which controls screen reader behavior.
   */
  export interface AccessibilityInformation {
    /**
     * Label to be read out by a screen reader once the item has focus.
     */
    label: string;

    /**
     * Role of the widget which defines how a screen reader interacts with it.
     * The role should be set in special cases when for example a tree-like element behaves like a checkbox.
     * If role is not specified VS Code will pick the appropriate role automatically.
     * More about aria roles can be found here https://w3c.github.io/aria/#widget_roles
     */
    role?: string;
  }

  /**
 * Represents the configuration. It is a merged view of
 *
 * - Default configuration
 * - Global configuration
 * - Workspace configuration (if available)
 * - Workspace folder configuration of the requested resource (if available)
 *
 * *Global configuration* comes from User Settings and shadows Defaults.
 *
 * *Workspace configuration* comes from Workspace Settings and shadows Global configuration.
 *
 * *Workspace Folder configuration* comes from `.vscode` folder under one of the [workspace folders](#workspace.workspaceFolders).
 *
 * *Note:* Workspace and Workspace Folder configurations contains `launch` and `tasks` settings. Their basename will be
 * part of the section identifier. The following snippets shows how to retrieve all configurations
 * from `launch.json`:
 *
 * ```ts
 * // launch.json configuration
 * const config = workspace.getConfiguration('launch', vscode.window.activeTextEditor.document.uri);
 *
 * // retrieve values
 * const values = config.get('configurations');
 * ```
 *
 * Refer to [Settings](https://code.visualstudio.com/docs/getstarted/settings) for more information.
 */

  export interface WorkspaceConfiguration {

    /**
     * Return a value from this configuration.
     *
     * @param section Configuration name, supports _dotted_ names.
     * @return The value `section` denotes or `undefined`.
     */
    get<T>(section: string): T | undefined;

    /**
     * Return a value from this configuration.
     *
     * @param section Configuration name, supports _dotted_ names.
     * @param defaultValue A value should be returned when no value could be found, is `undefined`.
     * @return The value `section` denotes or the default.
     */
    get<T>(section: string, defaultValue: T): T;

    /**
     * Check if this configuration has a certain value.
     *
     * @param section Configuration name, supports _dotted_ names.
     * @return `true` if the section doesn't resolve to `undefined`.
     */
    has(section: string): boolean;

    /**
     * Retrieve all information about a configuration setting. A configuration value
     * often consists of a *default* value, a global or installation-wide value,
     * a workspace-specific value and a folder-specific value.
     *
     * The *effective* value (returned by [`get`](#WorkspaceConfiguration.get))
     * is computed like this: `defaultValue` overwritten by `globalValue`,
     * `globalValue` overwritten by `workspaceValue`. `workspaceValue` overwritten by `workspaceFolderValue`.
     * Refer to [Settings Inheritance](https://code.visualstudio.com/docs/getstarted/settings)
     * for more information.
     *
     * *Note:* The configuration name must denote a leaf in the configuration tree
     * (`editor.fontSize` vs `editor`) otherwise no result is returned.
     *
     * @param section Configuration name, supports _dotted_ names.
     * @return Information about a configuration setting or `undefined`.
     */
    inspect<T>(section: string): { key: string; defaultValue?: T; globalValue?: T; workspaceValue?: T, workspaceFolderValue?: T } | undefined;

    /**
     * Update a configuration value. The updated configuration values are persisted.
     *
     * A value can be changed in
     *
     * - [Global configuration](#ConfigurationTarget.Global): Changes the value for all instances of the editor.
     * - [Workspace configuration](#ConfigurationTarget.Workspace): Changes the value for current workspace, if available.
     * - [Workspace folder configuration](#ConfigurationTarget.WorkspaceFolder): Changes the value for the
     * [Workspace folder](#workspace.workspaceFolders) to which the current [configuration](#WorkspaceConfiguration) is scoped to.
     *
     * *Note 1:* Setting a global value in the presence of a more specific workspace value
     * has no observable effect in that workspace, but in others. Setting a workspace value
     * in the presence of a more specific folder value has no observable effect for the resources
     * under respective [folder](#workspace.workspaceFolders), but in others. Refer to
     * [Settings Inheritance](https://code.visualstudio.com/docs/getstarted/settings) for more information.
     *
     * *Note 2:* To remove a configuration value use `undefined`, like so: `config.update('somekey', undefined)`
     *
     * Will throw error when
     * - Writing a configuration which is not registered.
     * - Writing a configuration to workspace or folder target when no workspace is opened
     * - Writing a configuration to folder target when there is no folder settings
     * - Writing to folder target without passing a resource when getting the configuration (`workspace.getConfiguration(section, resource)`)
     * - Writing a window configuration to folder target
     *
     * @param section Configuration name, supports _dotted_ names.
     * @param value The new value.
     * @param configurationTarget The [configuration target](#ConfigurationTarget) or a boolean value.
     *  - If `true` configuration target is `ConfigurationTarget.Global`.
     *  - If `false` configuration target is `ConfigurationTarget.Workspace`.
     *  - If `undefined` or `null` configuration target is
     *  `ConfigurationTarget.WorkspaceFolder` when configuration is resource specific
     *  `ConfigurationTarget.Workspace` otherwise.
     */
    update(section: string, value: any, configurationTarget?: ConfigurationTarget | boolean): Thenable<void>;

    /**
     * Readable dictionary that backs this configuration.
     */
    readonly [key: string]: any;
  }

  export interface ConfigurationChangeEvent {

    /**
     * Returns `true` if the given section for the given resource (if provided) is affected.
     *
     * @param section Configuration name, supports _dotted_ names.
     * @param resource A resource Uri.
     * @return `true` if the given section for the given resource (if provided) is affected.
     */
    affectsConfiguration(section: string, resource?: Uri): boolean;
  }

  /**
   * The configuration target
   */
  export enum ConfigurationTarget {
    /**
     * Global configuration
    */
    Global = 1,

    /**
     * Workspace configuration
     */
    Workspace = 2,

    /**
     * Workspace folder configuration
     */
    WorkspaceFolder = 3,
  }
  /**
   * A workspace folder is one of potentially many roots opened by the editor. All workspace folders
   * are equal which means there is no notion of an active or master workspace folder.
   */
  export interface WorkspaceFolder {

    /**
     * The associated uri for this workspace folder.
     *
     * *Note:* The [Uri](#Uri)-type was intentionally chosen such that future releases of the editor can support
     * workspace folders that are not stored on the local disk, e.g. `ftp://server/workspaces/foo`.
     */
    readonly uri: Uri;

    /**
     * The name of this workspace folder. Defaults to
     * the basename of its [uri-path](#Uri.path)
     */
    readonly name: string;

    /**
     * The ordinal number of this workspace folder.
     */
    readonly index: number;
  }

  /**
   * A uri handler is responsible for handling system-wide [uris](#Uri).
   *
   * @see [window.registerUriHandler](#window.registerUriHandler).
   */
  export interface UriHandler {

    /**
     * Handle the provided system-wide [uri](#Uri).
     *
     * @see [window.registerUriHandler](#window.registerUriHandler).
     */
    handleUri(uri: Uri): ProviderResult<void>;
  }

  /**
   * Content settings for a webview panel.
   */
  export interface WebviewPanelOptions {
    /**
     * Controls if the find widget is enabled in the panel.
     *
     * Defaults to false.
     */
    readonly enableFindWidget?: boolean;

    /**
     * Controls if the webview panel's content (iframe) is kept around even when the panel
     * is no longer visible.
     *
     * Normally the webview panel's html context is created when the panel becomes visible
     * and destroyed when it is hidden. Extensions that have complex state
     * or UI can set the `retainContextWhenHidden` to make VS Code keep the webview
     * context around, even when the webview moves to a background tab. When a webview using
     * `retainContextWhenHidden` becomes hidden, its scripts and other dynamic content are suspended.
     * When the panel becomes visible again, the context is automatically restored
     * in the exact same state it was in originally. You cannot send messages to a
     * hidden webview, even with `retainContextWhenHidden` enabled.
     *
     * `retainContextWhenHidden` has a high memory overhead and should only be used if
     * your panel's context cannot be quickly saved and restored.
     */
    readonly retainContextWhenHidden?: boolean;
  }

  /**
   * Value-object describing what options a terminal should use.
   */
  export interface TerminalOptions {
    /**
     * A human-readable string which will be used to represent the terminal in the UI.
     */
    name?: string;

    /**
     * A path to a custom shell executable to be used in the terminal.
     */
    shellPath?: string;

    /**
     * Args for the custom shell executable. A string can be used on Windows only which allows
     * specifying shell args in [command-line format](https://msdn.microsoft.com/en-au/08dfcab2-eb6e-49a4-80eb-87d4076c98c6).
     */
    shellArgs?: string[] | string;

    /**
     * A path or Uri for the current working directory to be used for the terminal.
     */
    cwd?: string | Uri;

    /**
     * Object with environment variables that will be added to the VS Code process.
     */
    env?: { [key: string]: string | null };

    /**
     * Whether the terminal process environment should be exactly as provided in
     * `TerminalOptions.env`. When this is false (default), the environment will be based on the
     * window's environment and also apply configured platform settings like
     * `terminal.integrated.windows.env` on top. When this is true, the complete environment
     * must be provided as nothing will be inherited from the process or any configuration.
     */
    strictEnv?: boolean;

    /**
     * When enabled the terminal will run the process as normal but not be surfaced to the user
     * until `Terminal.show` is called. The typical usage for this is when you need to run
     * something that may need interactivity but only want to tell the user about it when
     * interaction is needed. Note that the terminals will still be exposed to all extensions
     * as normal.
     */
    hideFromUser?: boolean;

    /**
     * Whether an extension is controlling the terminal via a `vscode.Pseudoterminal`.
     */
    isExtensionTerminal?: boolean;

    /**
     * A message to write to the terminal on first launch, note that this is not sent to the
     * process but, rather written directly to the terminal. This supports escape sequences such
     * a setting text style.
     */
    message?: string;

    /**
     * The icon path or {@link ThemeIcon} for the terminal.
     */
    iconPath?: Uri | { light: Uri; dark: Uri } | ThemeIcon;

    /**
     * The icon {@link ThemeColor} for the terminal.
     * The `terminal.ansi*` theme keys are
     * recommended for the best contrast and consistency across themes.
     */
    color?: ThemeColor;
  }

  /**
   * Provides information on a line in a terminal in order to provide links for it.
   */
  export interface TerminalLinkContext {
    /**
     * This is the text from the unwrapped line in the terminal.
     */
    line: string;

    /**
     * The terminal the link belongs to.
     */
    terminal: Terminal;
  }

  /**
   * A provider that enables detection and handling of links within terminals.
   */
  export interface TerminalLinkProvider<T extends TerminalLink = TerminalLink> {
    /**
     * Provide terminal links for the given context. Note that this can be called multiple times
     * even before previous calls resolve, make sure to not share global objects (eg. `RegExp`)
     * that could have problems when asynchronous usage may overlap.
     * @param context Information about what links are being provided for.
     * @param token A cancellation token.
     * @return A list of terminal links for the given line.
     */
    provideTerminalLinks(context: TerminalLinkContext, token: CancellationToken): ProviderResult<T[]>;

    /**
     * Handle an activated terminal link.
     * @param link The link to handle.
     */
    handleTerminalLink(link: T): ProviderResult<void>;
  }

  /**
   * A link on a terminal line.
   */
  export class TerminalLink {
    /**
     * The start index of the link on {@link TerminalLinkContext.line}.
     */
    startIndex: number;

    /**
     * The length of the link on {@link TerminalLinkContext.line}.
     */
    length: number;

    /**
     * The tooltip text when you hover over this link.
     *
     * If a tooltip is provided, is will be displayed in a string that includes instructions on
     * how to trigger the link, such as `{0} (ctrl + click)`. The specific instructions vary
     * depending on OS, user settings, and localization.
     */
    tooltip?: string;

    /**
     * Creates a new terminal link.
     * @param startIndex The start index of the link on {@link TerminalLinkContext.line}.
     * @param length The length of the link on {@link TerminalLinkContext.line}.
     * @param tooltip The tooltip text when you hover over this link.
     *
     * If a tooltip is provided, is will be displayed in a string that includes instructions on
     * how to trigger the link, such as `{0} (ctrl + click)`. The specific instructions vary
     * depending on OS, user settings, and localization.
     */
    constructor(startIndex: number, length: number, tooltip?: string);
  }


  /**
   * Provides a terminal profile for the contributed terminal profile when launched via the UI or
   * command.
   */
  export interface TerminalProfileProvider {
    /**
     * Provide the terminal profile.
     * @param token A cancellation token that indicates the result is no longer needed.
     * @returns The terminal profile.
     */
    provideTerminalProfile(token: CancellationToken): ProviderResult<TerminalProfile>;
  }

  /**
   * A terminal profile defines how a terminal will be launched.
   */
  export class TerminalProfile {
    /**
     * The options that the terminal will launch with.
     */
    options: TerminalOptions | ExtensionTerminalOptions;
    /**
     * Creates a new terminal profile.
     * @param options The options that the terminal will launch with.
     */
    constructor(options: TerminalOptions | ExtensionTerminalOptions);
  }

  /**
   * Class used to execute an extension callback as a task.
   */
  export class CustomExecution {
    /**
     * Constructs a CustomExecution task object. The callback will be executed the task is run, at which point the
     * extension should return the Pseudoterminal it will "run in". The task should wait to do further execution until
     * [Pseudoterminal.open](#Pseudoterminal.open) is called. Task cancellation should be handled using
     * [Pseudoterminal.close](#Pseudoterminal.close). When the task is complete fire
     * [Pseudoterminal.onDidClose](#Pseudoterminal.onDidClose).
     * @param process The [Pseudoterminal](#Pseudoterminal) to be used by the task to display output.
     * @param callback The callback that will be called when the task is started by a user.
     */
    constructor(callback: () => Thenable<Pseudoterminal>);
  }

  /**
   * Value-object describing what options a virtual process terminal should use.
   */
  export interface ExtensionTerminalOptions {
    /**
     * A human-readable string which will be used to represent the terminal in the UI.
     */
    name: string;

    /**
     * An implementation of [Pseudoterminal](#Pseudoterminal) that allows an extension to
     * control a terminal.
     */
    pty: Pseudoterminal;

    /**
     * The icon path or {@link ThemeIcon} for the terminal.
     */
    iconPath?: Uri | { light: Uri; dark: Uri } | ThemeIcon;

    /**
     * The icon {@link ThemeColor} for the terminal.
     * The standard `terminal.ansi*` theme keys are
     * recommended for the best contrast and consistency across themes.
     */
    color?: ThemeColor;
  }

  /**
   * Defines the interface of a terminal pty, enabling extensions to control a terminal.
   */
  interface Pseudoterminal {
    /**
     * An event that when fired will write data to the terminal. Unlike
     * [Terminal.sendText](#Terminal.sendText) which sends text to the underlying child
     * pseudo-device (the child), this will write the text to parent pseudo-device (the
     * _terminal_ itself).
     *
     * Note writing `\n` will just move the cursor down 1 row, you need to write `\r` as well
     * to move the cursor to the left-most cell.
     *
     * **Example:** Write red text to the terminal
     * ```typescript
     * const writeEmitter = new vscode.EventEmitter<string>();
     * const pty: vscode.Pseudoterminal = {
     *   onDidWrite: writeEmitter.event,
     *   open: () => writeEmitter.fire('\x1b[31mHello world\x1b[0m'),
     *   close: () => {}
     * };
     * vscode.window.createTerminal({ name: 'My terminal', pty });
     * ```
     *
     * **Example:** Move the cursor to the 10th row and 20th column and write an asterisk
     * ```typescript
     * writeEmitter.fire('\x1b[10;20H*');
     * ```
     */
    onDidWrite: Event<string>;

    /**
     * An event that when fired allows overriding the [dimensions](#Pseudoterminal.setDimensions) of the
     * terminal. Note that when set, the overridden dimensions will only take effect when they
     * are lower than the actual dimensions of the terminal (ie. there will never be a scroll
     * bar). Set to `undefined` for the terminal to go back to the regular dimensions (fit to
     * the size of the panel).
     *
     * **Example:** Override the dimensions of a terminal to 20 columns and 10 rows
     * ```typescript
     * const dimensionsEmitter = new vscode.EventEmitter<vscode.TerminalDimensions>();
     * const pty: vscode.Pseudoterminal = {
     *   onDidWrite: writeEmitter.event,
     *   onDidOverrideDimensions: dimensionsEmitter.event,
     *   open: () => {
     *     dimensionsEmitter.fire({
     *       columns: 20,
     *       rows: 10
     *     });
     *   },
     *   close: () => {}
     * };
     * vscode.window.createTerminal({ name: 'My terminal', pty });
     * ```
     */
    onDidOverrideDimensions?: Event<TerminalDimensions | undefined>;

    /**
     * An event that when fired will signal that the pty is closed and dispose of the terminal.
     *
     * A number can be used to provide an exit code for the terminal. Exit codes must be
     * positive and a non-zero exit codes signals failure which shows a notification for a
     * regular terminal and allows dependent tasks to proceed when used with the
     * `CustomExecution` API.
     *
     * **Example:** Exit the terminal when "y" is pressed, otherwise show a notification.
     * ```typescript
     * const writeEmitter = new vscode.EventEmitter<string>();
     * const closeEmitter = new vscode.EventEmitter<vscode.TerminalDimensions>();
     * const pty: vscode.Pseudoterminal = {
     *   onDidWrite: writeEmitter.event,
     *   onDidClose: closeEmitter.event,
     *   open: () => writeEmitter.fire('Press y to exit successfully'),
     *   close: () => {},
     *   handleInput: data => {
     *     if (data !== 'y') {
     *       vscode.window.showInformationMessage('Something went wrong');
     *     }
     *     closeEmitter.fire();
     *   }
     * };
     * vscode.window.createTerminal({ name: 'Exit example', pty });
     * ```
     */
    onDidClose?: Event<void | number>;

    /**
     * An event that when fired allows changing the name of the terminal.
     *
     * **Example:** Change the terminal name to "My new terminal".
     * ```typescript
     * const writeEmitter = new vscode.EventEmitter<string>();
     * const changeNameEmitter = new vscode.EventEmitter<string>();
     * const pty: vscode.Pseudoterminal = {
     *   onDidWrite: writeEmitter.event,
     *   onDidChangeName: changeNameEmitter.event,
     *   open: () => changeNameEmitter.fire('My new terminal'),
     *   close: () => {}
     * };
     * vscode.window.createTerminal({ name: 'My terminal', pty });
     * ```
     */
    onDidChangeName?: Event<string>;

    /**
     * Implement to handle when the pty is open and ready to start firing events.
     *
     * @param initialDimensions The dimensions of the terminal, this will be undefined if the
     * terminal panel has not been opened before this is called.
     */
    open(initialDimensions: TerminalDimensions | undefined): void;

    /**
     * Implement to handle when the terminal is closed by an act of the user.
     */
    close(): void;

    /**
     * Implement to handle incoming keystrokes in the terminal or when an extension calls
     * [Terminal.sendText](#Terminal.sendText). `data` contains the keystrokes/text serialized into
     * their corresponding VT sequence representation.
     *
     * @param data The incoming data.
     *
     * **Example:** Echo input in the terminal. The sequence for enter (`\r`) is translated to
     * CRLF to go to a new line and move the cursor to the start of the line.
     * ```typescript
     * const writeEmitter = new vscode.EventEmitter<string>();
     * const pty: vscode.Pseudoterminal = {
     *   onDidWrite: writeEmitter.event,
     *   open: () => {},
     *   close: () => {},
     *   handleInput: data => writeEmitter.fire(data === '\r' ? '\r\n' : data)
     * };
     * vscode.window.createTerminal({ name: 'Local echo', pty });
     * ```
     */
    handleInput?(data: string): void;

    /**
     * Implement to handle when the number of rows and columns that fit into the terminal panel
     * changes, for example when font size changes or when the panel is resized. The initial
     * state of a terminal's dimensions should be treated as `undefined` until this is triggered
     * as the size of a terminal isn't know until it shows up in the user interface.
     *
     * When dimensions are overridden by
     * [onDidOverrideDimensions](#Pseudoterminal.onDidOverrideDimensions), `setDimensions` will
     * continue to be called with the regular panel dimensions, allowing the extension continue
     * to react dimension changes.
     *
     * @param dimensions The new dimensions.
     */
    setDimensions?(dimensions: TerminalDimensions): void;
  }

  /**
   * The clipboard provides read and write access to the system's clipboard.
   */
  export interface Clipboard {

    /**
     * Read the current clipboard contents as text.
     * @returns A thenable that resolves to a string.
     */
    readText(): Thenable<string>;

    /**
     * Writes text into the clipboard.
     * @returns A thenable that resolves when writing happened.
     */
    writeText(value: string): Thenable<void>;
  }

  /**
   * A selection range represents a part of a selection hierarchy. A selection range
   * may have a parent selection range that contains it.
   */
  export class SelectionRange {

    /**
     * The [range](#Range) of this selection range.
     */
    range: Range;

    /**
     * The parent selection range containing this range.
     */
    parent?: SelectionRange;

    /**
     * Creates a new selection range.
     *
     * @param range The range of the selection range.
     * @param parent The parent of the selection range.
     */
    constructor(range: Range, parent?: SelectionRange);
  }
  /**
   * A tuple of two characters, like a pair of
   * opening and closing brackets.
   */
  export type CharacterPair = [string, string];

  /**
   * The workspace symbol provider interface defines the contract between extensions and
   * the [symbol search](https://code.visualstudio.com/docs/editor/editingevolved#_open-symbol-by-name)-feature.
   */
  export interface WorkspaceSymbolProvider<T extends SymbolInformation = SymbolInformation> {

    /**
     * Project-wide search for a symbol matching the given query string.
     *
     * The `query`-parameter should be interpreted in a *relaxed way* as the editor will apply its own highlighting
     * and scoring on the results. A good rule of thumb is to match case-insensitive and to simply check that the
     * characters of *query* appear in their order in a candidate symbol. Don't use prefix, substring, or similar
     * strict matching.
     *
     * To improve performance implementors can implement `resolveWorkspaceSymbol` and then provide symbols with partial
     * {@link SymbolInformation.location location}-objects, without a `range` defined. The editor will then call
     * `resolveWorkspaceSymbol` for selected symbols only, e.g. when opening a workspace symbol.
     *
     * @param query A query string, can be the empty string in which case all symbols should be returned.
     * @param token A cancellation token.
     * @return An array of document highlights or a thenable that resolves to such. The lack of a result can be
     * signaled by returning `undefined`, `null`, or an empty array.
     */
    provideWorkspaceSymbols(query: string, token: CancellationToken): ProviderResult<T[]>;

    /**
     * Given a symbol fill in its {@link SymbolInformation.location location}. This method is called whenever a symbol
     * is selected in the UI. Providers can implement this method and return incomplete symbols from
     * {@link WorkspaceSymbolProvider.provideWorkspaceSymbols `provideWorkspaceSymbols`} which often helps to improve
     * performance.
     *
     * @param symbol The symbol that is to be resolved. Guaranteed to be an instance of an object returned from an
     * earlier call to `provideWorkspaceSymbols`.
     * @param token A cancellation token.
     * @return The resolved symbol or a thenable that resolves to that. When no result is returned,
     * the given `symbol` is used.
     */
    resolveWorkspaceSymbol?(symbol: T, token: CancellationToken): ProviderResult<T>;
  }

  /**
   * Describes how comments for a language work.
   */
  export interface CommentRule {

    /**
     * The line comment token, like `// this is a comment`
     */
    lineComment?: string;

    /**
     * The block comment character pair, like `/* block comment *&#47;`
     */
    blockComment?: CharacterPair;
  }

  /**
   * Describes a rule to be evaluated when pressing Enter.
   */
  export interface OnEnterRule {
    /**
     * This rule will only execute if the text before the cursor matches this regular expression.
     */
    beforeText: RegExp;
    /**
     * This rule will only execute if the text after the cursor matches this regular expression.
     */
    afterText?: RegExp;
    /**
     * The action to execute.
     */
    action: EnterAction;

    previousLineText?: RegExp;
  }

  /**
   * Describes indentation rules for a language.
   */
  export interface IndentationRule {
    /**
     * If a line matches this pattern, then all the lines after it should be unindented once (until another rule matches).
     */
    decreaseIndentPattern: RegExp;
    /**
     * If a line matches this pattern, then all the lines after it should be indented once (until another rule matches).
     */
    increaseIndentPattern: RegExp;
    /**
     * If a line matches this pattern, then **only the next line** after it should be indented once.
     */
    indentNextLinePattern?: RegExp;
    /**
     * If a line matches this pattern, then its indentation should not be changed and it should not be evaluated against the other rules.
     */
    unIndentedLinePattern?: RegExp;
  }

  /**
   * A workspace folder is one of potentially many roots opened by the editor. All workspace folders
   * are equal which means there is no notion of an active or master workspace folder.
   */
  export interface WorkspaceFolder {

    /**
     * The associated uri for this workspace folder.
     *
     * *Note:* The [Uri](#Uri)-type was intentionally chosen such that future releases of the editor can support
     * workspace folders that are not stored on the local disk, e.g. `ftp://server/workspaces/foo`.
     */
    readonly uri: Uri;

    /**
     * The name of this workspace folder. Defaults to
     * the basename of its [uri-path](#Uri.path)
     */
    readonly name: string;

    /**
     * The ordinal number of this workspace folder.
     */
    readonly index: number;
  }
  /**
   * Represents reasons why a text document is saved.
   */
  export enum TextDocumentSaveReason {

    /**
     * Manually triggered, e.g. by the user pressing save, by starting debugging,
     * or by an API call.
     */
    Manual = 1,

    /**
     * Automatic after a delay.
     */
    AfterDelay = 2,

    /**
     * When the editor lost focus.
     */
    FocusOut = 3,
  }

  /**
   * Content settings for a webview.
   */
  export interface WebviewOptions {
    /**
     * Controls whether scripts are enabled in the webview content or not.
     *
     * Defaults to false (scripts-disabled).
     */
    readonly enableScripts?: boolean;


    /**
     * Controls whether forms are enabled in the webview content or not.
     *
     * Defaults to true if {@link WebviewOptions.enableScripts scripts are enabled}. Otherwise defaults to false.
     * Explicitly setting this property to either true or false overrides the default.
     */
    readonly enableForms?: boolean;

    /**
     * Controls whether command uris are enabled in webview content or not.
     *
     * Defaults to false.
     */
    readonly enableCommandUris?: boolean;

    /**
     * Root paths from which the webview can load local (filesystem) resources using the `vscode-resource:` scheme.
     *
     * Default to the root folders of the current workspace plus the extension's install directory.
     *
     * Pass in an empty array to disallow access to any local resources.
     */
    readonly localResourceRoots?: ReadonlyArray<Uri>;

    /**
     * Mappings of localhost ports used inside the webview.
     *
     * Port mapping allow webviews to transparently define how localhost ports are resolved. This can be used
     * to allow using a static localhost port inside the webview that is resolved to random port that a service is
     * running on.
     *
     * If a webview accesses localhost content, we recommend that you specify port mappings even if
     * the `webviewPort` and `extensionHostPort` ports are the same.
     *
     * *Note* that port mappings only work for `http` or `https` urls. Websocket urls (e.g. `ws://localhost:3000`)
     * cannot be mapped to another port.
     */
    readonly portMapping?: ReadonlyArray<WebviewPortMapping>;
  }

  /**
   * A webview displays html content, like an iframe.
   */
  export interface Webview {
    /**
     * Content settings for the webview.
     */
    options: WebviewOptions;

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

  /**
   * Represents the state of a window.
   */
  export interface WindowState {

    /**
     * Whether the current window is focused.
     */
    readonly focused: boolean;
  }

  /**
   * Represents a parameter of a callable-signature. A parameter can
   * have a label and a doc-comment.
   */
  export class ParameterInformation {

    /**
     * The label of this signature.
     *
     * Either a string or inclusive start and exclusive end offsets within its containing
     * [signature label](#SignatureInformation.label). *Note*: A label of type string must be
     * a substring of its containing signature information's [label](#SignatureInformation.label).
     */
    label: string | [number, number];

    /**
     * The human-readable doc-comment of this signature. Will be shown
     * in the UI but can be omitted.
     */
    documentation?: string | MarkdownString;

    /**
     * Creates a new parameter information object.
     *
     * @param label A label string or inclusive start and exclusive end offsets within its containing signature label.
     * @param documentation A doc string.
     */
    constructor(label: string | [number, number], documentation?: string | MarkdownString);
  }

  /**
   * How a [`SignatureHelpProvider`](#SignatureHelpProvider) was triggered.
   */
  export enum SignatureHelpTriggerKind {
    /**
     * Signature help was invoked manually by the user or by a command.
     */
    Invoke = 1,

    /**
     * Signature help was triggered by a trigger character.
     */
    TriggerCharacter = 2,

    /**
     * Signature help was triggered by the cursor moving or by the document content changing.
     */
    ContentChange = 3,
  }

  /**
   * Additional information about the context in which a
   * [`SignatureHelpProvider`](#SignatureHelpProvider.provideSignatureHelp) was triggered.
   */
  export interface SignatureHelpContext {
    /**
     * Action that caused signature help to be triggered.
     */
    readonly triggerKind: SignatureHelpTriggerKind;

    /**
     * Character that caused signature help to be triggered.
     *
     * This is `undefined` when signature help is not triggered by typing, such as when manually invoking
     * signature help or when moving the cursor.
     */
    readonly triggerCharacter?: string;

    /**
     * `true` if signature help was already showing when it was triggered.
     *
     * Retriggers occur when the signature help is already active and can be caused by actions such as
     * typing a trigger character, a cursor move, or document content changes.
     */
    readonly isRetrigger: boolean;

    /**
     * The currently active [`SignatureHelp`](#SignatureHelp).
     *
     * The `activeSignatureHelp` has its [`SignatureHelp.activeSignature`] field updated based on
     * the user arrowing through available signatures.
     */
    readonly activeSignatureHelp?: SignatureHelp;
  }

  /**
   * The signature help provider interface defines the contract between extensions and
   * the [parameter hints](https://code.visualstudio.com/docs/editor/intellisense)-feature.
   */
  export interface SignatureHelpProvider {

    /**
     * Provide help for the signature at the given position and document.
     *
     * @param document The document in which the command was invoked.
     * @param position The position at which the command was invoked.
     * @param token A cancellation token.
     * @param context Information about how signature help was triggered.
     *
     * @return Signature help or a thenable that resolves to such. The lack of a result can be
     * signaled by returning `undefined` or `null`.
     */
    provideSignatureHelp(document: TextDocument, position: Position, token: CancellationToken, context: SignatureHelpContext): ProviderResult<SignatureHelp>;
  }

  /**
   * Metadata about a registered [`SignatureHelpProvider`](#SignatureHelpProvider).
   */
  export interface SignatureHelpProviderMetadata {
    /**
     * List of characters that trigger signature help.
     */
    readonly triggerCharacters: ReadonlyArray<string>;

    /**
     * List of characters that re-trigger signature help.
     *
     * These trigger characters are only active when signature help is already showing. All trigger characters
     * are also counted as re-trigger characters.
     */
    readonly retriggerCharacters: ReadonlyArray<string>;
  }

  /**
   * Represents the signature of something callable. A signature
   * can have a label, like a function-name, a doc-comment, and
   * a set of parameters.
   */
  export class SignatureInformation {

    /**
     * The label of this signature. Will be shown in
     * the UI.
     */
    label: string;

    /**
     * The human-readable doc-comment of this signature. Will be shown
     * in the UI but can be omitted.
     */
    documentation?: string | MarkdownString;

    /**
     * The parameters of this signature.
     */
    parameters: ParameterInformation[];

    /**
     * The index of the active parameter.
     *
     * If provided, this is used in place of {@linkcode SignatureHelp.activeSignature}.
     */
    activeParameter?: number;

    /**
     * Creates a new signature information object.
     *
     * @param label A label string.
     * @param documentation A doc string.
     */
    constructor(label: string, documentation?: string | MarkdownString);
  }

  /**
   * Signature help represents the signature of something
   * callable. There can be multiple signatures but only one
   * active and only one active parameter.
   */
  export class SignatureHelp {

    /**
     * One or more signatures.
     */
    signatures: SignatureInformation[];

    /**
     * The active signature.
     */
    activeSignature: number;

    /**
     * The active parameter of the active signature.
     */
    activeParameter: number;
  }

  /**
   * Symbol tags are extra annotations that tweak the rendering of a symbol.
   */
  export enum SymbolTag {

    /**
     * Render a symbol as obsolete, usually using a strike-out.
     */
    Deprecated = 1,
  }

  /**
   * Represents information about programming constructs like variables, classes,
   * interfaces etc.
   */
  export class SymbolInformation {

    /**
     * The name of this symbol.
     */
    name: string;

    /**
     * The name of the symbol containing this symbol.
     */
    containerName: string;

    /**
     * The kind of this symbol.
     */
    kind: SymbolKind;

    /**
     * Tags for this symbol.
     */
    tags?: ReadonlyArray<SymbolTag>;

    /**
     * The location of this symbol.
     */
    location: Location;

    /**
     * Creates a new symbol information object.
     *
     * @param name The name of the symbol.
     * @param kind The kind of the symbol.
     * @param containerName The name of the symbol containing the symbol.
     * @param location The location of the symbol.
     */
    constructor(name: string, kind: SymbolKind, containerName: string, location: Location);

    /**
     * ~~Creates a new symbol information object.~~
     *
     * @deprecated Please use the constructor taking a [location](#Location) object.
     *
     * @param name The name of the symbol.
     * @param kind The kind of the symbol.
     * @param range The range of the location of the symbol.
     * @param uri The resource of the location of symbol, defaults to the current document.
     * @param containerName The name of the symbol containing the symbol.
     */
    constructor(name: string, kind: SymbolKind, range: Range, uri?: Uri, containerName?: string);
  }

  /**
   * A symbol kind.
   */
  export enum SymbolKind {
    File = 0,
    Module = 1,
    Namespace = 2,
    Package = 3,
    Class = 4,
    Method = 5,
    Property = 6,
    Field = 7,
    Constructor = 8,
    Enum = 9,
    Interface = 10,
    Function = 11,
    Variable = 12,
    Constant = 13,
    String = 14,
    Number = 15,
    Boolean = 16,
    Array = 17,
    Object = 18,
    Key = 19,
    Null = 20,
    EnumMember = 21,
    Struct = 22,
    Event = 23,
    Operator = 24,
    TypeParameter = 25,
  }
  /**
   * The version of the editor.
   */
  export const version: string;

  /**
   * In a remote window the extension kind describes if an extension
   * runs where the UI (window) runs or if an extension runs remotely.
   */
  export enum ExtensionKind {

    /**
     * Extension runs where the UI runs.
     */
    UI = 1,

    /**
     * Extension runs where the remote extension host runs.
     */
    Workspace = 2,
  }

  export interface SelectionRangeProvider {
    /**
     * Provide selection ranges for the given positions.
     *
     * Selection ranges should be computed individually and independend for each position. The editor will merge
     * and deduplicate ranges but providers must return hierarchies of selection ranges so that a range
     * is [contained](#Range.contains) by its parent.
     *
     * @param document The document in which the command was invoked.
     * @param positions The positions at which the command was invoked.
     * @param token A cancellation token.
     * @return Selection ranges or a thenable that resolves to such. The lack of a result can be
     * signaled by returning `undefined` or `null`.
     */
    provideSelectionRanges(document: TextDocument, positions: Position[], token: CancellationToken): ProviderResult<SelectionRange[]>;
  }
  /**
   * Contains additional information about the context in which
   * [completion provider](#CompletionItemProvider.provideCompletionItems) is triggered.
   */
  export interface CompletionContext {
    /**
     * How the completion was triggered.
     */
    readonly triggerKind: CompletionTriggerKind;

    /**
     * Character that triggered the completion item provider.
     *
     * `undefined` if provider was not triggered by a character.
     *
     * The trigger character is already in the document when the completion provider is triggered.
     */
    readonly triggerCharacter?: string;
  }

  /**
   * How a [completion provider](#CompletionItemProvider) was triggered
   */
  export enum CompletionTriggerKind {
    /**
     * Completion was triggered normally.
     */
    Invoke = 0,
    /**
     * Completion was triggered by a trigger character.
     */
    TriggerCharacter = 1,
    /**
     * Completion was re-triggered as current completion list is incomplete
     */
    TriggerForIncompleteCompletions = 2,
  }

  /**
   * Completion item kinds.
   */
  export enum CompletionItemKind {
    Text = 0,
    Method = 1,
    Function = 2,
    Constructor = 3,
    Field = 4,
    Variable = 5,
    Class = 6,
    Interface = 7,
    Module = 8,
    Property = 9,
    Unit = 10,
    Value = 11,
    Enum = 12,
    Keyword = 13,
    Snippet = 14,
    Color = 15,
    Reference = 17,
    File = 16,
    Folder = 18,
    EnumMember = 19,
    Constant = 20,
    Struct = 21,
    Event = 22,
    Operator = 23,
    TypeParameter = 24,
    User = 25,
    Issue = 26,
  }

  export enum CompletionItemTag {
    Deprecated = 1,
  }

  /**
   * Additional data for entries of a workspace edit. Supports to label entries and marks entries
   * as needing confirmation by the user. The editor groups edits with equal labels into tree nodes,
   * for instance all edits labelled with "Changes in Strings" would be a tree node.
   */
  export interface WorkspaceEditEntryMetadata {

    /**
     * A flag which indicates that user confirmation is needed.
     */
    needsConfirmation: boolean;

    /**
     * A human-readable string which is rendered prominent.
     */
    label: string;

    /**
     * A human-readable string which is rendered less prominent on the same line.
     */
    description?: string;

    /**
     * The icon path or [ThemeIcon](#ThemeIcon) for the edit.
     */
    iconPath?: Uri | { light: Uri; dark: Uri } | ThemeIcon;
  }

  /**
   * A workspace edit is a collection of textual and files changes for
   * multiple resources and documents.
   *
   * Use the [applyEdit](#workspace.applyEdit)-function to apply a workspace edit.
   */
  export class WorkspaceEdit {

    /**
     * The number of affected resources of textual or resource changes.
     */
    readonly size: number;

    /**
     * Replace the given range with given text for the given resource.
     *
     * @param uri A resource identifier.
     * @param range A range.
     * @param newText A string.
     */
    replace(uri: Uri, range: Range, newText: string, metadata?: WorkspaceEditEntryMetadata): void;

    /**
     * Insert the given text at the given position.
     *
     * @param uri A resource identifier.
     * @param position A position.
     * @param newText A string.
     */
    insert(uri: Uri, position: Position, newText: string, metadata?: WorkspaceEditEntryMetadata): void;

    /**
     * Delete the text at the given range.
     *
     * @param uri A resource identifier.
     * @param range A range.
     */
    delete(uri: Uri, range: Range, metadata?: WorkspaceEditEntryMetadata): void;

    /**
     * Check if a text edit for a resource exists.
     *
     * @param uri A resource identifier.
     * @return `true` if the given resource will be touched by this edit.
     */
    has(uri: Uri): boolean;

    /**
     * Set (and replace) text edits for a resource.
     *
     * @param uri A resource identifier.
     * @param edits An array of text edits.
     */
    set(uri: Uri, edits: TextEdit[]): void;

    /**
     * Get the text edits for a resource.
     *
     * @param uri A resource identifier.
     * @return An array of text edits.
     */
    get(uri: Uri): TextEdit[];

    /**
     * Create a regular file.
     *
     * @param uri Uri of the new file..
     * @param options Defines if an existing file should be overwritten or be
     * ignored. When overwrite and ignoreIfExists are both set overwrite wins.
     */
    createFile(uri: Uri, options?: { overwrite?: boolean, ignoreIfExists?: boolean }, metadata?: WorkspaceEditEntryMetadata): void;

    /**
     * Delete a file or folder.
     *
     * @param uri The uri of the file that is to be deleted.
     */
    deleteFile(uri: Uri, options?: { recursive?: boolean, ignoreIfNotExists?: boolean }, metadata?: WorkspaceEditEntryMetadata): void;

    /**
     * Rename a file or folder.
     *
     * @param oldUri The existing file.
     * @param newUri The new location.
     * @param options Defines if existing files should be overwritten or be
     * ignored. When overwrite and ignoreIfExists are both set overwrite wins.
     */
    renameFile(oldUri: Uri, newUri: Uri, options?: { overwrite?: boolean, ignoreIfExists?: boolean }, metadata?: WorkspaceEditEntryMetadata): void;

    /**
     * Get all text edits grouped by resource.
     *
     * @return A shallow copy of `[Uri, TextEdit[]]`-tuples.
     */
    entries(): [Uri, TextEdit[]][];
  }

  /**
   * Options for creating a [TreeView](#TreeView)
   */
  export interface TreeViewOptions<T> {

    /**
     * A data provider that provides tree data.
     */
    treeDataProvider: TreeDataProvider<T>;

    /**
     * Whether to show collapse all action or not.
     */
    showCollapseAll?: boolean;

    /**
     * Whether the tree supports multi-select. When the tree supports multi-select and a command is executed from the tree,
     * the first argument to the command is the tree item that the command was executed on and the second argument is an
     * array containing all selected tree items.
     */
    canSelectMany?: boolean;
  }

  /**
   * The event that is fired when an element in the [TreeView](#TreeView) is expanded or collapsed
   */
  export interface TreeViewExpansionEvent<T> {

    /**
     * Element that is expanded or collapsed.
     */
    readonly element: T;

  }

  /**
   * The event that is fired when there is a change in [tree view's selection](#TreeView.selection)
   */
  export interface TreeViewSelectionChangeEvent<T> {

    /**
     * Selected elements.
     */
    readonly selection: T[];

  }

  /**
   * The event that is fired when there is a change in [tree view's visibility](#TreeView.visible)
   */
  export interface TreeViewVisibilityChangeEvent {

    /**
     * `true` if the [tree view](#TreeView) is visible otherwise `false`.
     */
    readonly visible: boolean;

  }

  /**
   * Represents a Tree view
   */
  export interface TreeView<T> extends Disposable {

    /**
     * Event that is fired when an element is expanded
     */
    readonly onDidExpandElement: Event<TreeViewExpansionEvent<T>>;

    /**
     * Event that is fired when an element is collapsed
     */
    readonly onDidCollapseElement: Event<TreeViewExpansionEvent<T>>;

    /**
     * Currently selected elements.
     */
    readonly selection: T[];

    /**
     * Event that is fired when the [selection](#TreeView.selection) has changed
     */
    readonly onDidChangeSelection: Event<TreeViewSelectionChangeEvent<T>>;

    /**
     * `true` if the [tree view](#TreeView) is visible otherwise `false`.
     */
    readonly visible: boolean;

    /**
     * Event that is fired when [visibility](#TreeView.visible) has changed
     */
    readonly onDidChangeVisibility: Event<TreeViewVisibilityChangeEvent>;

    /**
     * An optional human-readable message that will be rendered in the view.
     * Setting the message to null, undefined, or empty string will remove the message from the view.
     */
    message?: string;

    /**
     * The tree view title is initially taken from the extension package.json
     * Changes to the title property will be properly reflected in the UI in the title of the view.
     */
    title?: string;

    /**
     * An optional human-readable description which is rendered less prominently in the title of the view.
     * Setting the title description to null, undefined, or empty string will remove the description from the view.
     */
    description?: string;

    /**
     * Reveals the given element in the tree view.
     * If the tree view is not visible then the tree view is shown and element is revealed.
     *
     * By default revealed element is selected.
     * In order to not to select, set the option `select` to `false`.
     * In order to focus, set the option `focus` to `true`.
     * In order to expand the revealed element, set the option `expand` to `true`. To expand recursively set `expand` to the number of levels to expand.
     * **NOTE:** You can expand only to 3 levels maximum.
     *
     * **NOTE:** The [TreeDataProvider](#TreeDataProvider) that the `TreeView` [is registered with](#window.createTreeView) with must implement [getParent](#TreeDataProvider.getParent) method to access this API.
     */
    reveal(element: T, options?: { select?: boolean, focus?: boolean, expand?: boolean | number }): Thenable<void>;
  }

  /**
 * Collapsible state of the tree item
 */
  export enum TreeItemCollapsibleState {
    /**
     * Determines an item can be neither collapsed nor expanded. Implies it has no children.
     */
    None = 0,
    /**
     * Determines an item is collapsed
     */
    Collapsed = 1,
    /**
     * Determines an item is expanded
     */
    Expanded = 2,
  }

  /**
   * A data provider that provides tree data
   */
  export interface TreeDataProvider<T> {
    /**
     * An optional event to signal that an element or root has changed.
     * This will trigger the view to update the changed element/root and its children recursively (if shown).
     * To signal that root has changed, do not pass any argument or pass `undefined` or `null`.
     */
    onDidChangeTreeData?: Event<T | undefined | null>;

    /**
     * Get [TreeItem](#TreeItem) representation of the `element`
     *
     * @param element The element for which [TreeItem](#TreeItem) representation is asked for.
     * @return [TreeItem](#TreeItem) representation of the element
     */
    getTreeItem(element: T): TreeItem | Thenable<TreeItem>;

    /**
     * Get the children of `element` or root if no element is passed.
     *
     * @param element The element from which the provider gets children. Can be `undefined`.
     * @return Children of `element` or root if no element is passed.
     */
    getChildren(element?: T): ProviderResult<T[]>;

    /**
     * Optional method to return the parent of `element`.
     * Return `null` or `undefined` if `element` is a child of root.
     *
     * **NOTE:** This method should be implemented in order to access [reveal](#TreeView.reveal) API.
     *
     * @param element The element for which the parent has to be returned.
     * @return Parent of `element`.
     */
    getParent?(element: T): ProviderResult<T>;

    /**
     * Called on hover to resolve the {@link TreeItem.tooltip TreeItem} property if it is undefined.
     * Called on tree item click/open to resolve the {@link TreeItem.command TreeItem} property if it is undefined.
     * Only properties that were undefined can be resolved in `resolveTreeItem`.
     * Functionality may be expanded later to include being called to resolve other missing
     * properties on selection and/or on open.
     *
     * Will only ever be called once per TreeItem.
     *
     * onDidChangeTreeData should not be triggered from within resolveTreeItem.
     *
     * *Note* that this function is called when tree items are already showing in the UI.
     * Because of that, no property that changes the presentation (label, description, etc.)
     * can be changed.
     *
     * @param item Undefined properties of `item` should be set then `item` should be returned.
     * @param element The object associated with the TreeItem.
     * @param token A cancellation token.
     * @return The resolved tree item or a thenable that resolves to such. It is OK to return the given
     * `item`. When no result is returned, the given `item` will be used.
     */
    resolveTreeItem?(item: TreeItem, element: T, token: CancellationToken): ProviderResult<TreeItem>;
  }

  export class TreeItem {
    /**
     * A human-readable string describing this item. When `falsy`, it is derived from {@link TreeItem.resourceUri resourceUri}.
     */
    label?: string | TreeItemLabel;

    /**
     * Optional id for the tree item that has to be unique across tree. The id is used to preserve the selection and expansion state of the tree item.
     *
     * If not provided, an id is generated using the tree item's label. **Note** that when labels change, ids will change and that selection and expansion state cannot be kept stable anymore.
     */
    id?: string;

    /**
     * The icon path or [ThemeIcon](#ThemeIcon) for the tree item.
     * When `falsy`, [Folder Theme Icon](#ThemeIcon.Folder) is assigned, if item is collapsible otherwise [File Theme Icon](#ThemeIcon.File).
     * When a [ThemeIcon](#ThemeIcon) is specified, icon is derived from the current file icon theme for the specified theme icon using [resourceUri](#TreeItem.resourceUri) (if provided).
     */
    iconPath?: string | Uri | { light: string | Uri; dark: string | Uri } | ThemeIcon;

    /**
     * A human readable string which is rendered less prominent.
     * When `true`, it is derived from [resourceUri](#TreeItem.resourceUri) and when `falsy`, it is not shown.
     */
    description?: string | boolean;

    /**
     * The [uri](#Uri) of the resource representing this item.
     *
     * Will be used to derive the [label](#TreeItem.label), when it is not provided.
     * Will be used to derive the icon from current icon theme, when [iconPath](#TreeItem.iconPath) has [ThemeIcon](#ThemeIcon) value.
     */
    resourceUri?: Uri;

    /**
     * The tooltip text when you hover over this item.
     */
    tooltip?: string | undefined;

    /**
     * The [command](#Command) that should be executed when the tree item is selected.
     */
    command?: Command;

    /**
     * [TreeItemCollapsibleState](#TreeItemCollapsibleState) of the tree item.
     */
    collapsibleState?: TreeItemCollapsibleState;

    /**
     * Context value of the tree item. This can be used to contribute item specific actions in the tree.
     * For example, a tree item is given a context value as `folder`. When contributing actions to `view/item/context`
     * using `menus` extension point, you can specify context value for key `viewItem` in `when` expression like `viewItem == folder`.
     * ```
     *  "contributes": {
     *    "menus": {
     *      "view/item/context": [
     *        {
     *          "command": "extension.deleteFolder",
     *          "when": "viewItem == folder"
     *        }
     *      ]
     *    }
     *  }
     * ```
     * This will show action `extension.deleteFolder` only for items with `contextValue` is `folder`.
     */
    contextValue?: string;

    /**
     * Accessibility information used when screen reader interacts with this tree item.
     * Generally, a TreeItem has no need to set the `role` of the accessibilityInformation;
     * however, there are cases where a TreeItem is not displayed in a tree-like way where setting the `role` may make sense.
     */
    accessibilityInformation?: AccessibilityInformation;

    /**
     * @param label A human-readable string describing this item
     * @param collapsibleState {@link TreeItemCollapsibleState} of the tree item. Default is {@link TreeItemCollapsibleState.None}
     */
    constructor(label: string | TreeItemLabel, collapsibleState?: TreeItemCollapsibleState);

    /**
     * @param resourceUri The {@link Uri} of the resource representing this item.
     * @param collapsibleState {@link TreeItemCollapsibleState} of the tree item. Default is {@link TreeItemCollapsibleState.None}
     */
    constructor(resourceUri: Uri, collapsibleState?: TreeItemCollapsibleState);
  }
  /**
   * Represents a line of text, such as a line of source code.
   *
   * TextLine objects are __immutable__. When a [document](#TextDocument) changes,
   * previously retrieved lines will not represent the latest state.
   */
  export interface TextLine {

    /**
     * The zero-based line number.
     */
    readonly lineNumber: number;

    /**
     * The text of this line without the line separator characters.
     */
    readonly text: string;

    /**
     * The range this line covers without the line separator characters.
     */
    readonly range: Range;

    /**
     * The range this line covers with the line separator characters.
     */
    readonly rangeIncludingLineBreak: Range;

    /**
     * The offset of the first character which is not a whitespace character as defined
     * by `/\s/`. **Note** that if a line is all whitespace the length of the line is returned.
     */
    readonly firstNonWhitespaceCharacterIndex: number;

    /**
     * Whether this line is whitespace only, shorthand
     * for [TextLine.firstNonWhitespaceCharacterIndex](#TextLine.firstNonWhitespaceCharacterIndex) === [TextLine.text.length](#TextLine.text).
     */
    readonly isEmptyOrWhitespace: boolean;
  }
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
    /* tslint:disable-next-line */
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
    /* tslint:disable-next-line */
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
   * Represents a text selection in an editor.
   */
  export class Selection extends Range {

    /**
     * The position at which the selection starts.
     * This position might be before or after [active](#Selection.active).
     */
    anchor: Position;

    /**
     * The position of the cursor.
     * This position might be before or after [anchor](#Selection.anchor).
     */
    active: Position;

    /**
     * Create a selection from two positions.
     *
     * @param anchor A position.
     * @param active A position.
     */
    constructor(anchor: Position, active: Position);

    /**
     * Create a selection from four coordinates.
     *
     * @param anchorLine A zero-based line value.
     * @param anchorCharacter A zero-based character value.
     * @param activeLine A zero-based line value.
     * @param activeCharacter A zero-based character value.
     */
    constructor(anchorLine: number, anchorCharacter: number, activeLine: number, activeCharacter: number);

    /**
     * A selection is reversed if [active](#Selection.active).isBefore([anchor](#Selection.anchor)).
     */
    isReversed: boolean;
  }

  /**
   * A complex edit that will be applied in one transaction on a TextEditor.
   * This holds a description of the edits and if the edits are valid (i.e. no overlapping regions, document was not changed in the meantime, etc.)
   * they can be applied on a [document](#TextDocument) associated with a [text editor](#TextEditor).
   *
   */

  /**
   * A universal resource identifier representing either a file on disk
   * or another resource, like untitled resources.
   */
  export class Uri {

    /**
     * Create an URI from a string, e.g. `http://www.msft.com/some/path`,
     * `file:///usr/home`, or `scheme:with/path`.
     *
     * *Note* that for a while uris without a `scheme` were accepted. That is not correct
     * as all uris should have a scheme. To avoid breakage of existing code the optional
     * `strict`-argument has been added. We *strongly* advise to use it, e.g. `Uri.parse('my:uri', true)`
     *
     * @see [Uri.toString](#Uri.toString)
     * @param value The string value of an Uri.
     * @param strict Throw an error when `value` is empty or when no `scheme` can be parsed.
     * @return A new Uri instance.
     */
    static parse(value: string, strict?: boolean): Uri;

    /**
     * Create an URI from a file system path. The [scheme](#Uri.scheme)
     * will be `file`.
     *
     * The *difference* between `Uri#parse` and `Uri#file` is that the latter treats the argument
     * as path, not as stringified-uri. E.g. `Uri.file(path)` is *not* the same as
     * `Uri.parse('file://' + path)` because the path might contain characters that are
     * interpreted (# and ?). See the following sample:
     * ```ts
    const good = URI.file('/coding/c#/project1');
    good.scheme === 'file';
    good.path === '/coding/c#/project1';
    good.fragment === '';

    const bad = URI.parse('file://' + '/coding/c#/project1');
    bad.scheme === 'file';
    bad.path === '/coding/c'; // path is now broken
    bad.fragment === '/project1';
    ```
     *
     * @param path A file system or UNC path.
     * @return A new Uri instance.
     */
    static file(path: string): Uri;

    /**
     * Create a new uri which path is the result of joining
     * the path of the base uri with the provided path segments.
     *
     * - Note 1: `joinPath` only affects the path component
     * and all other components (scheme, authority, query, and fragment) are
     * left as they are.
     * - Note 2: The base uri must have a path; an error is thrown otherwise.
     *
     * The path segments are normalized in the following ways:
     * - sequences of path separators (`/` or `\`) are replaced with a single separator
     * - for `file`-uris on windows, the backslash-character (`\`) is considered a path-separator
     * - the `..`-segment denotes the parent segment, the `.` denotes the current segment
     * - paths have a root which always remains, for instance on windows drive-letters are roots
     * so that is true: `joinPath(Uri.file('file:///c:/root'), '../../other').fsPath === 'c:/other'`
     *
     * @param base An uri. Must have a path.
     * @param pathSegments One more more path fragments
     * @returns A new uri which path is joined with the given fragments
     */
    static joinPath(base: Uri, ...pathSegments: string[]): Uri;

    /**
     * Use the `file` and `parse` factory functions to create new `Uri` objects.
     */
    private constructor(scheme: string, authority: string, path: string, query: string, fragment: string);

    /**
     * Scheme is the `http` part of `http://www.msft.com/some/path?query#fragment`.
     * The part before the first colon.
     */
    readonly scheme: string;

    /**
     * Authority is the `www.msft.com` part of `http://www.msft.com/some/path?query#fragment`.
     * The part between the first double slashes and the next slash.
     */
    readonly authority: string;

    /**
     * Path is the `/some/path` part of `http://www.msft.com/some/path?query#fragment`.
     */
    readonly path: string;

    /**
     * Query is the `query` part of `http://www.msft.com/some/path?query#fragment`.
     */
    readonly query: string;

    /**
     * Fragment is the `fragment` part of `http://www.msft.com/some/path?query#fragment`.
     */
    readonly fragment: string;

    /**
     * The string representing the corresponding file system path of this Uri.
     *
     * Will handle UNC paths and normalize windows drive letters to lower-case. Also
     * uses the platform specific path separator.
     *
     * * Will *not* validate the path for invalid characters and semantics.
     * * Will *not* look at the scheme of this Uri.
     * * The resulting string shall *not* be used for display purposes but
     * for disk operations, like `readFile` et al.
     *
     * The *difference* to the [`path`](#Uri.path)-property is the use of the platform specific
     * path separator and the handling of UNC paths. The sample below outlines the difference:
     * ```ts
    const u = URI.parse('file://server/c$/folder/file.txt')
    u.authority === 'server'
    u.path === '/shares/c$/file.txt'
    u.fsPath === '\\server\c$\folder\file.txt'
    ```
     */
    readonly fsPath: string;

    /**
     * Derive a new Uri from this Uri.
     *
     * ```ts
     * let file = Uri.parse('before:some/file/path');
     * let other = file.with({ scheme: 'after' });
     * assert.ok(other.toString() === 'after:some/file/path');
     * ```
     *
     * @param change An object that describes a change to this Uri. To unset components use `null` or
     *  the empty string.
     * @return A new Uri that reflects the given change. Will return `this` Uri if the change
     *  is not changing anything.
     */
    with(change: { scheme?: string; authority?: string; path?: string; query?: string; fragment?: string }): Uri;

    /**
     * Returns a string representation of this Uri. The representation and normalization
     * of a URI depends on the scheme.
     *
     * * The resulting string can be safely used with [Uri.parse](#Uri.parse).
     * * The resulting string shall *not* be used for display purposes.
     *
     * *Note* that the implementation will encode _aggressive_ which often leads to unexpected,
     * but not incorrect, results. For instance, colons are encoded to `%3A` which might be unexpected
     * in file-uri. Also `&` and `=` will be encoded which might be unexpected for http-uris. For stability
     * reasons this cannot be changed anymore. If you suffer from too aggressive encoding you should use
     * the `skipEncoding`-argument: `uri.toString(true)`.
     *
     * @param skipEncoding Do not percentage-encode the result, defaults to `false`. Note that
     *  the `#` and `?` characters occurring in the path will always be encoded.
     * @returns A string representation of this Uri.
     */
    toString(skipEncoding?: boolean): string;

    /**
     * Returns a JSON representation of this Uri.
     *
     * @return An object.
     */
    toJSON(): any;

  }

  /**
   * Represents a typed event.
   *
   * A function that represents an event to which you subscribe by calling it with
   * a listener function as argument.
   *
   * @sample `item.onDidChange(function(event) { console.log("Event happened: " + event); });`
   */
  export interface Event<T> {

    /**
     * A function that represents an event to which you subscribe by calling it with
     * a listener function as argument.
     *
     * @param listener The listener function will be called when the event happens.
     * @param thisArgs The `this`-argument which will be used when calling the event listener.
     * @param disposables An array to which a [disposable](#Disposable) will be added.
     * @return A disposable which unsubscribes the event listener.
     */
    /* tslint:disable-next-line */
    (listener: (e: T) => any, thisArgs?: any, disposables?: Disposable[]): Disposable;
  }

  /**
   * An event emitter can be used to create and manage an [event](#Event) for others
   * to subscribe to. One emitter always owns one event.
   *
   * Use this class if you want to provide event from within your extension, for instance
   * inside a [TextDocumentContentProvider](#TextDocumentContentProvider) or when providing
   * API to other extensions.
   */
  export class EventEmitter<T> {

    /**
     * The event listeners can subscribe to.
     */
    event: Event<T>;

    /**
     * Notify all subscribers of the [event](#EventEmitter.event). Failure
     * of one or more listener will not fail this function call.
     *
     * @param data The event object.
     */
    fire(data?: T): void;

    /**
     * Dispose this object and free resources.
     */
    dispose(): void;
  }

  /**
   * A cancellation token is passed to an asynchronous or long running
   * operation to request cancellation, like cancelling a request
   * for completion items because the user continued to type.
   *
   * To get an instance of a `CancellationToken` use a
   * [CancellationTokenSource](#CancellationTokenSource).
   */
  export interface CancellationToken {

    /**
     * Is `true` when the token has been cancelled, `false` otherwise.
     */
    isCancellationRequested: boolean;

    /**
     * An [event](#Event) which fires upon cancellation.
     */
    onCancellationRequested: Event<any>;
  }

  /**
   * A cancellation source creates and controls a [cancellation token](#CancellationToken).
   */
  export class CancellationTokenSource {

    /**
     * The cancellation token of this source.
     */
    token: CancellationToken;

    /**
     * Signal cancellation on the token.
     */
    cancel(): void;

    /**
     * Dispose object and free resources.
     */
    dispose(): void;
  }

  export enum TextDocumentChangeReason {
    /** The text change is caused by an undo operation. */
    Undo = 1,

    /** The text change is caused by an redo operation. */
    Redo = 2,
  }

  /**
   * An event describing a transactional [document](#TextDocument) change.
   */
  export interface TextDocumentChangeEvent {

    /**
     * The affected document.
     */
    readonly document: TextDocument;

    /**
     * An array of content changes.
     */
    readonly contentChanges: ReadonlyArray<TextDocumentContentChangeEvent>;

    /**
     * The reason why the document was changed.
     * Is `undefined` if the reason is not known.
    */
    readonly reason: TextDocumentChangeReason | undefined;
  }

  /**
   * Represents a related message and source code location for a diagnostic. This should be
   * used to point to code locations that cause or related to a diagnostics, e.g. when duplicating
   * a symbol in a scope.
   */
  export class DiagnosticRelatedInformation {

    /**
     * The location of this related diagnostic information.
     */
    location: Location;

    /**
     * The message of this related diagnostic information.
     */
    message: string;

    /**
     * Creates a new related diagnostic information object.
     *
     * @param location The location.
     * @param message The message.
     */
    constructor(location: Location, message: string);
  }

  /**
   * Additional metadata about the type of a diagnostic.
   */
  export enum DiagnosticTag {
    /**
     * Unused or unnecessary code.
     *
     * Diagnostics with this tag are rendered faded out. The amount of fading
     * is controlled by the `"editorUnnecessaryCode.opacity"` theme color. For
     * example, `"editorUnnecessaryCode.opacity": "#000000c0"` will render the
     * code with 75% opacity. For high contrast themes, use the
     * `"editorUnnecessaryCode.border"` theme color to underline unnecessary code
     * instead of fading it out.
     */
    Unnecessary = 1,
    Deprecated = 2,
  }

  /**
   * Represents the severity of diagnostics.
   */
  export enum DiagnosticSeverity {

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
    Information = 2,

    /**
     * Something to hint to a better way of doing it, like proposing
     * a refactoring.
     */
    Hint = 3,
  }

  /**
   * Represents a diagnostic, such as a compiler error or warning. Diagnostic objects
   * are only valid in the scope of a file.
   */
  export class Diagnostic {

    /**
     * The range to which this diagnostic applies.
     */
    range: Range;

    /**
     * The human-readable message.
     */
    message: string;

    /**
     * The severity, default is [error](#DiagnosticSeverity.Error).
     */
    severity: DiagnosticSeverity;

    /**
     * A human-readable string describing the source of this
     * diagnostic, e.g. 'typescript' or 'super lint'.
     */
    source?: string;

    /**
     * A code or identifier for this diagnostic.
     * Should be used for later processing, e.g. when providing [code actions](#CodeActionContext).
     */
    code?: string | number;

    /**
     * An array of related diagnostic information, e.g. when symbol-names within
     * a scope collide all definitions can be marked via this property.
     */
    relatedInformation?: DiagnosticRelatedInformation[];

    /**
     * Additional metadata about the diagnostic.
     */
    tags?: DiagnosticTag[];

    /**
     * Creates a new diagnostic object.
     *
     * @param range The range to which this diagnostic applies.
     * @param message The human-readable message.
     * @param severity The severity, default is [error](#DiagnosticSeverity.Error).
     */
    constructor(range: Range, message: string, severity?: DiagnosticSeverity);
  }
  /**
   * An error type that should be used to signal cancellation of an operation.
   *
   * This type can be used in response to a [cancellation token](#CancellationToken)
   * being cancelled or when an operation is being cancelled by the
   * executor of that operation.
   */
  export class CancellationError extends Error {

    /**
     * Creates a new cancellation error.
     */
    constructor();
  }
  /**
   * Represents a type which can release resources, such
   * as event listening or a timer.
   */
  export class Disposable {

    /**
     * Combine many disposable-likes into one. Use this method
     * when having objects with a dispose function which are not
     * instances of Disposable.
     *
     * @param disposableLikes Objects that have at least a `dispose`-function member.
     * @return Returns a new disposable which, upon dispose, will
     * dispose all provided disposables.
     */
    static from(...disposableLikes: { dispose: () => any }[]): Disposable;

    /**
     * Creates a new Disposable calling the provided function
     * on dispose.
     * @param callOnDispose Function that disposes something.
     */
    constructor(callOnDispose: () => void);

    /**
     * Dispose this object.
     */
    dispose(): any;
  }

  /**
   * Represents an extension.
   *
   * To get an instance of an `Extension` use [getExtension](#extensions.getExtension).
   */
  export interface Extension<T> {

    /**
     * The canonical extension identifier in the form of: `publisher.name`.
     */
    readonly id: string;

    /**
     * The uri of the directory containing the extension.
     */
    readonly extensionUri: Uri;

    /**
     * The absolute file path of the directory containing this extension.
     */
    readonly extensionPath: string;

    /**
     * `true` if the extension has been activated.
     */
    readonly isActive: boolean;

    /**
     * The parsed contents of the extension's package.json.
     */
    readonly packageJSON: any;

    /**
     * The extension kind describes if an extension runs where the UI runs
     * or if an extension runs where the remote extension host runs. The extension kind
     * if defined in the `package.json` file of extensions but can also be refined
     * via the the `remote.extensionKind`-setting. When no remote extension host exists,
     * the value is [`ExtensionKind.UI`](#ExtensionKind.UI).
     */
    extensionKind: ExtensionKind;

    /**
     * The public API exported by this extension. It is an invalid action
     * to access this field before this extension has been activated.
     */
    readonly exports: T;

    /**
     * Activates this extension and returns its public API.
     *
     * @return A promise that will resolve when this extension has been activated.
     */
    activate(): Thenable<T>;
  }

  /**
   * A memento represents a storage utility. It can store and retrieve
   * values.
   */
  export interface Memento {

    /**
     * Return a value.
     *
     * @param key A string.
     * @return The stored value or `undefined`.
     */
    get<T>(key: string): T | undefined;

    /**
     * Return a value.
     *
     * @param key A string.
     * @param defaultValue A value that should be returned when there is no
     * value (`undefined`) with the given key.
     * @return The stored value or the defaultValue.
     */
    get<T>(key: string, defaultValue: T): T;

    /**
     * Store a value. The value must be JSON-stringifyable.
     *
     * @param key A string.
     * @param value A value. MUST not contain cyclic references.
     */
    update(key: string, value: any): Thenable<void>;

    /**
     * VS Code proposal API, maybe remove on latest version.
     * #region https://github.com/microsoft/vscode/issues/87110
     * The stored keys.
     */
    readonly keys: readonly string[];
  }

  /**
 * The event data that is fired when a secret is added or removed.
 */
  export interface SecretStorageChangeEvent {
    /**
     * The key of the secret that has changed.
     */
    readonly key: string;
  }

  /**
   * Represents a storage utility for secrets, information that is
   * sensitive.
   */
  export interface SecretStorage {
    /**
     * Retrieve a secret that was stored with key. Returns undefined if there
     * is no password matching that key.
     * @param key The key the secret was stored under.
     * @returns The stored value or `undefined`.
     */
    get(key: string): Thenable<string | undefined>;

    /**
     * Store a secret under a given key.
     * @param key The key to store the secret under.
     * @param value The secret.
     */
    store(key: string, value: string): Thenable<void>;

    /**
     * Remove a secret from storage.
     * @param key The key the secret was stored under.
     */
    delete(key: string): Thenable<void>;

    /**
     * Fires when a secret is stored or deleted.
     */
    onDidChange: Event<SecretStorageChangeEvent>;
  }

  /**
   * Represents how a terminal exited.
   */
  export interface TerminalExitStatus {
    /**
     * The exit code that a terminal exited with, it can have the following values:
     * - Zero: the terminal process or custom execution succeeded.
     * - Non-zero: the terminal process or custom execution failed.
     * - `undefined`: the user forcibly closed the terminal or a custom execution exited
     *   without providing an exit code.
     */
    readonly code: number | undefined;
  }

  export interface Terminal {

    /**
     * The name of the terminal.
     */
    readonly name: string;

    /**
     * The process ID of the shell process.
     */
    readonly processId: Thenable<number>;

    /**
     * The object used to initialize the terminal, this is useful for example to detecting the
     * shell type of when the terminal was not launched by this extension or for detecting what
     * folder the shell was launched in.
     */
    readonly creationOptions: Readonly<TerminalOptions | ExtensionTerminalOptions>;
    /**
     * The exit status of the terminal, this will be undefined while the terminal is active.
     *
     * **Example:** Show a notification with the exit code when the terminal exits with a
     * non-zero exit code.
     * ```typescript
     * window.onDidCloseTerminal(t => {
     *   if (t.exitStatus && t.exitStatus.code) {
     *     vscode.window.showInformationMessage(`Exit code: ${t.exitStatus.code}`);
     *   }
     * });
     * ```
     */
    readonly exitStatus: TerminalExitStatus | undefined;

    /**
     * Send text to the terminal. The text is written to the stdin of the underlying pty process
     * (shell) of the terminal.
     *
     * @param text The text to send.
     * @param addNewLine Whether to add a new line to the text being sent, this is normally
     * required to run a command in the terminal. The character(s) added are \n or \r\n
     * depending on the platform. This defaults to `true`.
     */
    sendText(text: string, addNewLine?: boolean): void;

    /**
     * Show the terminal panel and reveal this terminal in the UI.
     *
     * @param preserveFocus When `true` the terminal will not take focus.
     */
    show(preserveFocus?: boolean): void;

    /**
     * Hide the terminal panel if this terminal is currently showing.
     */
    hide(): void;

    /**
     * Dispose and free associated resources.
     */
    dispose(): void;
  }

  //#region EnvironmentVariable

  /**
   * A type of mutation that can be applied to an environment variable.
   */
  export enum EnvironmentVariableMutatorType {
    /**
     * Replace the variable's existing value.
     */
    Replace = 1,
    /**
     * Append to the end of the variable's existing value.
     */
    Append = 2,
    /**
     * Prepend to the start of the variable's existing value.
     */
    Prepend = 3,
  }

  /**
   * A type of mutation and its value to be applied to an environment variable.
   */
  export interface EnvironmentVariableMutator {
    /**
     * The type of mutation that will occur to the variable.
     */
    readonly type: EnvironmentVariableMutatorType;

    /**
     * The value to use for the variable.
     */
    readonly value: string;
  }

  /**
   * A collection of mutations that an extension can apply to a process environment.
   */
  export interface EnvironmentVariableCollection {
    /**
     * Whether the collection should be cached for the workspace and applied to the terminal
     * across window reloads. When true the collection will be active immediately such when the
     * window reloads. Additionally, this API will return the cached version if it exists. The
     * collection will be invalidated when the extension is uninstalled or when the collection
     * is cleared. Defaults to true.
     */
    persistent: boolean;

    /**
     * Replace an environment variable with a value.
     *
     * Note that an extension can only make a single change to any one variable, so this will
     * overwrite any previous calls to replace, append or prepend.
     *
     * @param variable The variable to replace.
     * @param value The value to replace the variable with.
     */
    replace(variable: string, value: string): void;

    /**
     * Append a value to an environment variable.
     *
     * Note that an extension can only make a single change to any one variable, so this will
     * overwrite any previous calls to replace, append or prepend.
     *
     * @param variable The variable to append to.
     * @param value The value to append to the variable.
     */
    append(variable: string, value: string): void;

    /**
     * Prepend a value to an environment variable.
     *
     * Note that an extension can only make a single change to any one variable, so this will
     * overwrite any previous calls to replace, append or prepend.
     *
     * @param variable The variable to prepend.
     * @param value The value to prepend to the variable.
     */
    prepend(variable: string, value: string): void;

    /**
     * Gets the mutator that this collection applies to a variable, if any.
     *
     * @param variable The variable to get the mutator for.
     */
    get(variable: string): EnvironmentVariableMutator | undefined;

    /**
     * Iterate over each mutator in this collection.
     *
     * @param callback Function to execute for each entry.
     * @param thisArg The `this` context used when invoking the handler function.
     */
    forEach(callback: (variable: string, mutator: EnvironmentVariableMutator, collection: EnvironmentVariableCollection) => any, thisArg?: any): void;

    /**
     * Deletes this collection's mutator for a variable.
     *
     * @param variable The variable to delete the mutator for.
     */
    delete(variable: string): void;

    /**
     * Clears all mutators from this collection.
     */
    clear(): void;
  }

  //#endregion

  /**
   * An extension context is a collection of utilities private to an
   * extension.
   *
   * An instance of an `ExtensionContext` is provided as the first
   * parameter to the `activate`-call of an extension.
   */
  export interface ExtensionContext {

    /**
     * An array to which disposables can be added. When this
     * extension is deactivated the disposables will be disposed.
     */
    readonly subscriptions: { dispose(): any }[];

    /**
     * A memento object that stores state in the context
     * of the currently opened [workspace](#workspace.workspaceFolders).
     */
    readonly workspaceState: Memento;

    /**
     * A memento object that stores state independent
     * of the current opened [workspace](#workspace.workspaceFolders).
     */
    readonly globalState: Memento & {
      /**
       * Set the keys whose values should be synchronized across devices when synchronizing user-data
       * like configuration, extensions, and mementos.
       *
       * Note that this function defines the whole set of keys whose values are synchronized:
       *  - calling it with an empty array stops synchronization for this memento
       *  - calling it with a non-empty array replaces all keys whose values are synchronized
       *
       * For any given set of keys this function needs to be called only once but there is no harm in
       * repeatedly calling it.
       *
       * @param keys The set of keys whose values are synced.
       */
      setKeysForSync(keys: string[]): void;
    };

    /**
     * The absolute file path of the directory containing the extension.
     */
    readonly extensionPath: string;

    /**
     * A storage utility for secrets. Secrets are persisted across reloads and are independent of the
     * current opened {@link workspace.workspaceFolders workspace}.
     */
    readonly secrets: SecretStorage;

    /**
     * The uri of the directory containing the extension.
     */
    readonly extensionUri: Uri;

    /**
     * Gets the extension's environment variable collection for this workspace, enabling changes
     * to be applied to terminal environment variables.
     */
    readonly environmentVariableCollection: EnvironmentVariableCollection;

    /**
     * Get the absolute path of a resource contained in the extension.
     *
     * @param relativePath A relative path to a resource contained in the extension.
     * @return The absolute path of the resource.
     */
    asAbsolutePath(relativePath: string): string;

    /**
     * An absolute file path of a workspace specific directory in which the extension
     * can store private state. The directory might not exist on disk and creation is
     * up to the extension. However, the parent directory is guaranteed to be existent.
     *
     * Use [`workspaceState`](#ExtensionContext.workspaceState) or
     * [`globalState`](#ExtensionContext.globalState) to store key value data.
     *
     * @deprecated Use [storagePath](#ExtensionContent.storageUri) instead.
     */
    readonly storagePath: string | undefined;

    /**
     * The uri of a workspace specific directory in which the extension
     * can store private state. The directory might not exist and creation is
     * up to the extension. However, the parent directory is guaranteed to be existent.
     * The value is `undefined` when no workspace nor folder has been opened.
     *
     * Use [`workspaceState`](#ExtensionContext.workspaceState) or
     * [`globalState`](#ExtensionContext.globalState) to store key value data.
     *
     * @see [`workspace.fs`](#FileSystem) for how to read and write files and folders from
     *  an uri.
     */
    readonly storageUri: Uri | undefined;

    /**
     * An absolute file path in which the extension can store global state.
     * The directory might not exist on disk and creation is
     * up to the extension. However, the parent directory is guaranteed to be existent.
     *
     * Use [`globalState`](#ExtensionContext.globalState) to store key value data.
     *
     * @deprecated Use [globalStoragePath](#ExtensionContent.globalStorageUri) instead.
     */
    readonly globalStoragePath: string;

    /**
     * The uri of a directory in which the extension can store global state.
     * The directory might not exist on disk and creation is
     * up to the extension. However, the parent directory is guaranteed to be existent.
     *
     * Use [`globalState`](#ExtensionContext.globalState) to store key value data.
     *
     * @see [`workspace.fs`](#FileSystem) for how to read and write files and folders from
     *  an uri.
     */
    readonly globalStorageUri: Uri;

    /**
     * An absolute file path of a directory in which the extension can create log files.
     * The directory might not exist on disk and creation is up to the extension. However,
     * the parent directory is guaranteed to be existent.
     *
     * @deprecated Use [logUri](#ExtensionContext.logUri) instead.
     */
    readonly logPath: string;

    /**
     * The uri of a directory in which the extension can create log files.
     * The directory might not exist on disk and creation is up to the extension. However,
     * the parent directory is guaranteed to be existent.
     *
     * @see [`workspace.fs`](#FileSystem) for how to read and write files and folders from
     *  an uri.
     */
    readonly logUri: Uri;

    /**
     * The mode the extension is running in. This is specific to the current
     * extension. One extension may be in `ExtensionMode.Development` while
     * other extensions in the host run in `ExtensionMode.Release`.
     */
    readonly extensionMode: ExtensionMode;
    /**
     * The current `Extension` instance.
     */
    readonly extension: Extension<any>;
  }

  /**
   * The ExtensionMode is provided on the `ExtensionContext` and indicates the
   * mode the specific extension is running in.
   */
  export enum ExtensionMode {
    /**
     * The extension is installed normally (for example, from the marketplace
     * or VSIX) in VS Code.
     */
    Production = 1,

    /**
     * The extension is running from an `--extensionDevelopmentPath` provided
     * when launching VS Code.
     */
    Development = 2,

    /**
     * The extension is running from an `--extensionTestsPath` and
     * the extension host is running unit tests.
     */
    Test = 3,
  }

  /**
   * A file system watcher notifies about changes to files and folders
   * on disk.
   *
   * To get an instance of a `FileSystemWatcher` use
   * [createFileSystemWatcher](#workspace.createFileSystemWatcher).
   */
  export interface FileSystemWatcher extends Disposable {

    /**
     * true if this file system watcher has been created such that
     * it ignores creation file system events.
     */
    ignoreCreateEvents: boolean;

    /**
     * true if this file system watcher has been created such that
     * it ignores change file system events.
     */
    ignoreChangeEvents: boolean;

    /**
     * true if this file system watcher has been created such that
     * it ignores delete file system events.
     */
    ignoreDeleteEvents: boolean;

    /**
     * An event which fires on file/folder creation.
     */
    onDidCreate: Event<Uri>;

    /**
     * An event which fires on file/folder change.
     */
    onDidChange: Event<Uri>;

    /**
     * An event which fires on file/folder deletion.
     */
    onDidDelete: Event<Uri>;
  }

  /**
   * Enumeration of file types. The types `File` and `Directory` can also be
   * a symbolic links, in that use `FileType.File | FileType.SymbolicLink` and
   * `FileType.Directory | FileType.SymbolicLink`.
   */
  export enum FileType {
    /**
     * The file type is unknown.
     */
    Unknown = 0,
    /**
     * A regular file.
     */
    File = 1,
    /**
     * A directory.
     */
    Directory = 2,
    /**
     * A symbolic link to a file.
     */
    SymbolicLink = 64,
  }

  //#region FileSystemProvider stat readonly - https://github.com/microsoft/vscode/issues/73122

  export enum FilePermission {
    /**
     * The file is readonly.
     *
     * *Note:* All `FileStat` from a `FileSystemProvider` that is registered  with
     * the option `isReadonly: true` will be implicitly handled as if `FilePermission.Readonly`
     * is set. As a consequence, it is not possible to have a readonly file system provider
     * registered where some `FileStat` are not readonly.
     */
    Readonly = 1
  }

  /**
   * The `FileStat`-type represents metadata about a file
   */
  export interface FileStat {
    /**
     * The type of the file, e.g. is a regular file, a directory, or symbolic link
     * to a file.
     */
    type: FileType;
    /**
     * The creation timestamp in milliseconds elapsed since January 1, 1970 00:00:00 UTC.
     */
    ctime: number;
    /**
     * The modification timestamp in milliseconds elapsed since January 1, 1970 00:00:00 UTC.
     */
    mtime: number;
    /**
     * The size in bytes.
     */
    size: number;
    /**
     * The permissions of the file, e.g. whether the file is readonly.
     *
     * *Note:* This value might be a bitmask, e.g. `FilePermission.Readonly | FilePermission.Other`.
     */
    permissions?: FilePermission;
  }

  /**
   * A type that filesystem providers should use to signal errors.
   *
   * This class has factory methods for common error-cases, like `FileNotFound` when
   * a file or folder doesn't exist, use them like so: `throw vscode.FileSystemError.FileNotFound(someUri);`
   */
  export class FileSystemError extends Error {

    /**
     * Create an error to signal that a file or folder wasn't found.
     * @param messageOrUri Message or uri.
     */
    static FileNotFound(messageOrUri?: string | Uri): FileSystemError;

    /**
     * Create an error to signal that a file or folder already exists, e.g. when
     * creating but not overwriting a file.
     * @param messageOrUri Message or uri.
     */
    static FileExists(messageOrUri?: string | Uri): FileSystemError;

    /**
     * Create an error to signal that a file is not a folder.
     * @param messageOrUri Message or uri.
     */
    static FileNotADirectory(messageOrUri?: string | Uri): FileSystemError;

    /**
     * Create an error to signal that a file is a folder.
     * @param messageOrUri Message or uri.
     */
    static FileIsADirectory(messageOrUri?: string | Uri): FileSystemError;

    /**
     * Create an error to signal that an operation lacks required permissions.
     * @param messageOrUri Message or uri.
     */
    static NoPermissions(messageOrUri?: string | Uri): FileSystemError;

    /**
     * Create an error to signal that the file system is unavailable or too busy to
     * complete a request.
     * @param messageOrUri Message or uri.
     */
    static Unavailable(messageOrUri?: string | Uri): FileSystemError;

    /**
     * Creates a new filesystem error.
     *
     * @param messageOrUri Message or uri.
     */
    constructor(messageOrUri?: string | Uri);

    /**
     * A code that identifies this error.
     *
     * Possible values are names of errors, like [`FileNotFound`](#FileSystemError.FileNotFound),
     * or `Unknown` for unspecified errors.
     */
    readonly code: string;
  }

  /**
   * Enumeration of file change types.
   */
  export enum FileChangeType {

    /**
     * The contents or metadata of a file have changed.
     */
    Changed = 1,

    /**
     * A file has been created.
     */
    Created = 2,

    /**
     * A file has been deleted.
     */
    Deleted = 3,
  }

  /**
   * The event filesystem providers must use to signal a file change.
   */
  export interface FileChangeEvent {

    /**
     * The type of change.
     */
    readonly type: FileChangeType;

    /**
     * The uri of the file that has changed.
     */
    readonly uri: Uri;
  }

  /**
   * The filesystem provider defines what the editor needs to read, write, discover,
   * and to manage files and folders. It allows extensions to serve files from remote places,
   * like ftp-servers, and to seamlessly integrate those into the editor.
   *
   * * *Note 1:* The filesystem provider API works with [uris](#Uri) and assumes hierarchical
   * paths, e.g. `foo:/my/path` is a child of `foo:/my/` and a parent of `foo:/my/path/deeper`.
   * * *Note 2:* There is an activation event `onFileSystem:<scheme>` that fires when a file
   * or folder is being accessed.
   * * *Note 3:* The word 'file' is often used to denote all [kinds](#FileType) of files, e.g.
   * folders, symbolic links, and regular files.
   */
  export interface FileSystemProvider {

    /**
     * An event to signal that a resource has been created, changed, or deleted. This
     * event should fire for resources that are being [watched](#FileSystemProvider.watch)
     * by clients of this provider.
     */
    readonly onDidChangeFile: Event<FileChangeEvent[]>;

    /**
     * Subscribe to events in the file or folder denoted by `uri`.
     *
     * The editor will call this function for files and folders. In the latter case, the
     * options differ from defaults, e.g. what files/folders to exclude from watching
     * and if subfolders, sub-subfolder, etc. should be watched (`recursive`).
     *
     * @param uri The uri of the file to be watched.
     * @param options Configures the watch.
     * @returns A disposable that tells the provider to stop watching the `uri`.
     */
    watch(uri: Uri, options: { recursive: boolean; excludes: string[] }): Disposable;

    /**
     * Retrieve metadata about a file.
     *
     * Note that the metadata for symbolic links should be the metadata of the file they refer to.
     * Still, the [SymbolicLink](#FileType.SymbolicLink)-type must be used in addition to the actual type, e.g.
     * `FileType.SymbolicLink | FileType.Directory`.
     *
     * @param uri The uri of the file to retrieve metadata about.
     * @return The file metadata about the file.
     * @throws [`FileNotFound`](#FileSystemError.FileNotFound) when `uri` doesn't exist.
     */
    stat(uri: Uri): FileStat | Thenable<FileStat>;

    /**
     * Retrieve all entries of a [directory](#FileType.Directory).
     *
     * @param uri The uri of the folder.
     * @return An array of name/type-tuples or a thenable that resolves to such.
     * @throws [`FileNotFound`](#FileSystemError.FileNotFound) when `uri` doesn't exist.
     */
    readDirectory(uri: Uri): [string, FileType][] | Thenable<[string, FileType][]>;

    /**
     * Create a new directory (Note, that new files are created via `write`-calls).
     *
     * @param uri The uri of the new folder.
     * @throws [`FileNotFound`](#FileSystemError.FileNotFound) when the parent of `uri` doesn't exist, e.g. no mkdirp-logic required.
     * @throws [`FileExists`](#FileSystemError.FileExists) when `uri` already exists.
     * @throws [`NoPermissions`](#FileSystemError.NoPermissions) when permissions aren't sufficient.
     */
    createDirectory(uri: Uri): void | Thenable<void>;

    /**
     * Read the entire contents of a file.
     *
     * @param uri The uri of the file.
     * @return An array of bytes or a thenable that resolves to such.
     * @throws [`FileNotFound`](#FileSystemError.FileNotFound) when `uri` doesn't exist.
     */
    readFile(uri: Uri): Uint8Array | Thenable<Uint8Array>;

    /**
     * Write data to a file, replacing its entire contents.
     *
     * @param uri The uri of the file.
     * @param content The new content of the file.
     * @param options Defines if missing files should or must be created.
     * @throws [`FileNotFound`](#FileSystemError.FileNotFound) when `uri` doesn't exist and `create` is not set.
     * @throws [`FileNotFound`](#FileSystemError.FileNotFound) when the parent of `uri` doesn't exist and `create` is set, e.g. no mkdirp-logic required.
     * @throws [`FileExists`](#FileSystemError.FileExists) when `uri` already exists, `create` is set but `overwrite` is not set.
     * @throws [`NoPermissions`](#FileSystemError.NoPermissions) when permissions aren't sufficient.
     */
    writeFile(uri: Uri, content: Uint8Array, options: { create: boolean, overwrite: boolean }): void | Thenable<void>;

    /**
     * Delete a file.
     *
     * @param uri The resource that is to be deleted.
     * @param options Defines if deletion of folders is recursive.
     * @throws [`FileNotFound`](#FileSystemError.FileNotFound) when `uri` doesn't exist.
     * @throws [`NoPermissions`](#FileSystemError.NoPermissions) when permissions aren't sufficient.
     */
    delete(uri: Uri, options: { recursive: boolean }): void | Thenable<void>;

    /**
     * Rename a file or folder.
     *
     * @param oldUri The existing file.
     * @param newUri The new location.
     * @param options Defines if existing files should be overwritten.
     * @throws [`FileNotFound`](#FileSystemError.FileNotFound) when `oldUri` doesn't exist.
     * @throws [`FileNotFound`](#FileSystemError.FileNotFound) when parent of `newUri` doesn't exist, e.g. no mkdirp-logic required.
     * @throws [`FileExists`](#FileSystemError.FileExists) when `newUri` exists and when the `overwrite` option is not `true`.
     * @throws [`NoPermissions`](#FileSystemError.NoPermissions) when permissions aren't sufficient.
     */
    rename(oldUri: Uri, newUri: Uri, options: { overwrite: boolean }): void | Thenable<void>;

    /**
     * Copy files or folders. Implementing this function is optional but it will speedup
     * the copy operation.
     *
     * @param source The existing file.
     * @param destination The destination location.
     * @param options Defines if existing files should be overwritten.
     * @throws [`FileNotFound`](#FileSystemError.FileNotFound) when `source` doesn't exist.
     * @throws [`FileNotFound`](#FileSystemError.FileNotFound) when parent of `destination` doesn't exist, e.g. no mkdirp-logic required.
     * @throws [`FileExists`](#FileSystemError.FileExists) when `destination` exists and when the `overwrite` option is not `true`.
     * @throws [`NoPermissions`](#FileSystemError.NoPermissions) when permissions aren't sufficient.
     */
    copy?(source: Uri, destination: Uri, options: { overwrite: boolean }): void | Thenable<void>;
  }

  export interface FileSystem {
    stat(uri: Uri): Thenable<FileStat>;
    readDirectory(uri: Uri): Thenable<[string, FileType][]>;
    createDirectory(uri: Uri): Thenable<void>;
    readFile(uri: Uri): Thenable<Uint8Array>;
    writeFile(uri: Uri, content: Uint8Array, options?: { create: boolean, overwrite: boolean }): Thenable<void>;
    delete(uri: Uri, options?: { recursive: boolean }): Thenable<void>;
    rename(source: Uri, target: Uri, options?: { overwrite: boolean }): Thenable<void>;
    copy(source: Uri, target: Uri, options?: { overwrite: boolean }): Thenable<void>;
    isWritableFileSystem(scheme: string): boolean | undefined;
  }

  /**
   * Represents the configuration. It is a merged view of
   *
   * - Default configuration
   * - Global configuration
   * - Workspace configuration (if available)
   * - Workspace folder configuration of the requested resource (if available)
   *
   * *Global configuration* comes from User Settings and shadows Defaults.
   *
   * *Workspace configuration* comes from Workspace Settings and shadows Global configuration.
   *
   * *Workspace Folder configuration* comes from `.vscode` folder under one of the [workspace folders](#workspace.workspaceFolders).
   *
   * *Note:* Workspace and Workspace Folder configurations contains `launch` and `tasks` settings. Their basename will be
   * part of the section identifier. The following snippets shows how to retrieve all configurations
   * from `launch.json`:
   *
   * ```ts
   * // launch.json configuration
   * const config = workspace.getConfiguration('launch', vscode.window.activeTextEditor.document.uri);
   *
   * // retrieve values
   * const values = config.get('configurations');
   * ```
   *
   * Refer to [Settings](https://code.visualstudio.com/docs/getstarted/settings) for more information.
   */

  /**
   * An output channel is a container for readonly textual information.
   *
   * To get an instance of an `OutputChannel` use
   * [createOutputChannel](#window.createOutputChannel).
   */
  /**
   * Defines a generalized way of reporting progress updates.
   */
  export interface Progress<T> {

    /**
     * Report a progress update.
     * @param value A progress item, like a message and/or an
     * report on how much work finished
     */
    report(value: T): void;
  }

  /**
   * A location in the editor at which progress information can be shown. It depends on the
   * location how progress is visually represented.
   */
  export enum ProgressLocation {

    /**
     * Show progress for the source control viewlet, as overlay for the icon and as progress bar
     * inside the viewlet (when visible). Neither supports cancellation nor discrete progress.
     */
    SourceControl = 1,

    /**
     * Show progress in the status bar of the editor. Neither supports cancellation nor discrete progress.
     */
    Window = 10,

    /**
     * Show progress as notification with an optional cancel button. Supports to show infinite and discrete progress.
     */
    Notification = 15,
  }

  /**
   * Value-object describing where and how progress should show.
   */
  export interface ProgressOptions {

    /**
     * The location at which progress should show.
     */
    location: ProgressLocation;

    /**
     * A human-readable string which will be used to describe the
     * operation.
     */
    title?: string;

    /**
     * Controls if a cancel button should show to allow the user to
     * cancel the long running operation.  Note that currently only
     * `ProgressLocation.Notification` is supporting to show a cancel
     * button.
     */
    cancellable?: boolean;
  }

  /**
   * Possible kinds of UI that can use extensions.
   */
  export enum UIKind {

    /**
     * Extensions are accessed from a desktop application.
     */
    Desktop = 1,

    /**
     * Extensions are accessed from a web browser.
     */
    Web = 2,
  }

  //#region Semantic Tokens

  /**
   * A semantic tokens legend contains the needed information to decipher
   * the integer encoded representation of semantic tokens.
   */
  export class SemanticTokensLegend {
    /**
     * The possible token types.
     */
    public readonly tokenTypes: string[];
    /**
     * The possible token modifiers.
     */
    public readonly tokenModifiers: string[];

    constructor(tokenTypes: string[], tokenModifiers?: string[]);
  }

  /**
   * A semantic tokens builder can help with creating a `SemanticTokens` instance
   * which contains delta encoded semantic tokens.
   */
  export class SemanticTokensBuilder {

    constructor(legend?: SemanticTokensLegend);

    /**
     * Add another token.
     *
     * @param line The token start line number (absolute value).
     * @param char The token start character (absolute value).
     * @param length The token length in characters.
     * @param tokenType The encoded token type.
     * @param tokenModifiers The encoded token modifiers.
     */
    push(line: number, char: number, length: number, tokenType: number, tokenModifiers?: number): void;

    /**
     * Add another token. Use only when providing a legend.
     *
     * @param range The range of the token. Must be single-line.
     * @param tokenType The token type.
     * @param tokenModifiers The token modifiers.
     */
    push(range: Range, tokenType: string, tokenModifiers?: string[]): void;

    /**
     * Finish and create a `SemanticTokens` instance.
     */
    build(resultId?: string): SemanticTokens;
  }

  /**
   * Represents semantic tokens, either in a range or in an entire document.
   * @see [provideDocumentSemanticTokens](#DocumentSemanticTokensProvider.provideDocumentSemanticTokens) for an explanation of the format.
   * @see [SemanticTokensBuilder](#SemanticTokensBuilder) for a helper to create an instance.
   */
  export class SemanticTokens {
    /**
     * The result id of the tokens.
     *
     * This is the id that will be passed to `DocumentSemanticTokensProvider.provideDocumentSemanticTokensEdits` (if implemented).
     */
    readonly resultId?: string;
    /**
     * The actual tokens data.
     * @see [provideDocumentSemanticTokens](#DocumentSemanticTokensProvider.provideDocumentSemanticTokens) for an explanation of the format.
     */
    readonly data: Uint32Array;

    constructor(data: Uint32Array, resultId?: string);
  }

  /**
   * Represents edits to semantic tokens.
   * @see [provideDocumentSemanticTokensEdits](#DocumentSemanticTokensProvider.provideDocumentSemanticTokensEdits) for an explanation of the format.
   */
  export class SemanticTokensEdits {
    /**
     * The result id of the tokens.
     *
     * This is the id that will be passed to `DocumentSemanticTokensProvider.provideDocumentSemanticTokensEdits` (if implemented).
     */
    readonly resultId?: string;
    /**
     * The edits to the tokens data.
     * All edits refer to the initial data state.
     */
    readonly edits: SemanticTokensEdit[];

    constructor(edits: SemanticTokensEdit[], resultId?: string);
  }

  /**
   * Represents an edit to semantic tokens.
   * @see [provideDocumentSemanticTokensEdits](#DocumentSemanticTokensProvider.provideDocumentSemanticTokensEdits) for an explanation of the format.
   */
  export class SemanticTokensEdit {
    /**
     * The start offset of the edit.
     */
    readonly start: number;
    /**
     * The count of elements to remove.
     */
    readonly deleteCount: number;
    /**
     * The elements to insert.
     */
    readonly data?: Uint32Array;

    constructor(start: number, deleteCount: number, data?: Uint32Array);
  }
  /**
   * The document semantic tokens provider interface defines the contract between extensions and
   * semantic tokens.
   */
  export interface DocumentSemanticTokensProvider {
    /**
     * An optional event to signal that the semantic tokens from this provider have changed.
     */
    onDidChangeSemanticTokens?: Event<void>;

    /**
     * Tokens in a file are represented as an array of integers. The position of each token is expressed relative to
     * the token before it, because most tokens remain stable relative to each other when edits are made in a file.
     *
     * ---
     * In short, each token takes 5 integers to represent, so a specific token `i` in the file consists of the following array indices:
     *  - at index `5*i`   - `deltaLine`: token line number, relative to the previous token
     *  - at index `5*i+1` - `deltaStart`: token start character, relative to the previous token (relative to 0 or the previous token's start if they are on the same line)
     *  - at index `5*i+2` - `length`: the length of the token. A token cannot be multiline.
     *  - at index `5*i+3` - `tokenType`: will be looked up in `SemanticTokensLegend.tokenTypes`. We currently ask that `tokenType` < 65536.
     *  - at index `5*i+4` - `tokenModifiers`: each set bit will be looked up in `SemanticTokensLegend.tokenModifiers`
     *
     * ---
     * ### How to encode tokens
     *
     * Here is an example for encoding a file with 3 tokens in a uint32 array:
     * ```
     *    { line: 2, startChar:  5, length: 3, tokenType: "property",  tokenModifiers: ["private", "static"] },
     *    { line: 2, startChar: 10, length: 4, tokenType: "type",      tokenModifiers: [] },
     *    { line: 5, startChar:  2, length: 7, tokenType: "class",     tokenModifiers: [] }
     * ```
     *
     * 1. First of all, a legend must be devised. This legend must be provided up-front and capture all possible token types.
     * For this example, we will choose the following legend which must be passed in when registering the provider:
     * ```
     *    tokenTypes: ['property', 'type', 'class'],
     *    tokenModifiers: ['private', 'static']
     * ```
     *
     * 2. The first transformation step is to encode `tokenType` and `tokenModifiers` as integers using the legend. Token types are looked
     * up by index, so a `tokenType` value of `1` means `tokenTypes[1]`. Multiple token modifiers can be set by using bit flags,
     * so a `tokenModifier` value of `3` is first viewed as binary `0b00000011`, which means `[tokenModifiers[0], tokenModifiers[1]]` because
     * bits 0 and 1 are set. Using this legend, the tokens now are:
     * ```
     *    { line: 2, startChar:  5, length: 3, tokenType: 0, tokenModifiers: 3 },
     *    { line: 2, startChar: 10, length: 4, tokenType: 1, tokenModifiers: 0 },
     *    { line: 5, startChar:  2, length: 7, tokenType: 2, tokenModifiers: 0 }
     * ```
     *
     * 3. The next step is to represent each token relative to the previous token in the file. In this case, the second token
     * is on the same line as the first token, so the `startChar` of the second token is made relative to the `startChar`
     * of the first token, so it will be `10 - 5`. The third token is on a different line than the second token, so the
     * `startChar` of the third token will not be altered:
     * ```
     *    { deltaLine: 2, deltaStartChar: 5, length: 3, tokenType: 0, tokenModifiers: 3 },
     *    { deltaLine: 0, deltaStartChar: 5, length: 4, tokenType: 1, tokenModifiers: 0 },
     *    { deltaLine: 3, deltaStartChar: 2, length: 7, tokenType: 2, tokenModifiers: 0 }
     * ```
     *
     * 4. Finally, the last step is to inline each of the 5 fields for a token in a single array, which is a memory friendly representation:
     * ```
     *    // 1st token,  2nd token,  3rd token
     *    [  2,5,3,0,3,  0,5,4,1,0,  3,2,7,2,0 ]
     * ```
     *
     * @see [SemanticTokensBuilder](#SemanticTokensBuilder) for a helper to encode tokens as integers.
     * *NOTE*: When doing edits, it is possible that multiple edits occur until VS Code decides to invoke the semantic tokens provider.
     * *NOTE*: If the provider cannot temporarily compute semantic tokens, it can indicate this by throwing an error with the message 'Busy'.
     */
    provideDocumentSemanticTokens(document: TextDocument, token: CancellationToken): ProviderResult<SemanticTokens>;

    /**
     * Instead of always returning all the tokens in a file, it is possible for a `DocumentSemanticTokensProvider` to implement
     * this method (`provideDocumentSemanticTokensEdits`) and then return incremental updates to the previously provided semantic tokens.
     *
     * ---
     * ### How tokens change when the document changes
     *
     * Suppose that `provideDocumentSemanticTokens` has previously returned the following semantic tokens:
     * ```
     *    // 1st token,  2nd token,  3rd token
     *    [  2,5,3,0,3,  0,5,4,1,0,  3,2,7,2,0 ]
     * ```
     *
     * Also suppose that after some edits, the new semantic tokens in a file are:
     * ```
     *    // 1st token,  2nd token,  3rd token
     *    [  3,5,3,0,3,  0,5,4,1,0,  3,2,7,2,0 ]
     * ```
     * It is possible to express these new tokens in terms of an edit applied to the previous tokens:
     * ```
     *    [  2,5,3,0,3,  0,5,4,1,0,  3,2,7,2,0 ] // old tokens
     *    [  3,5,3,0,3,  0,5,4,1,0,  3,2,7,2,0 ] // new tokens
     *
     *    edit: { start:  0, deleteCount: 1, data: [3] } // replace integer at offset 0 with 3
     * ```
     *
     * *NOTE*: If the provider cannot compute `SemanticTokensEdits`, it can "give up" and return all the tokens in the document again.
     * *NOTE*: All edits in `SemanticTokensEdits` contain indices in the old integers array, so they all refer to the previous result state.
     */
    provideDocumentSemanticTokensEdits?(document: TextDocument, previousResultId: string, token: CancellationToken): ProviderResult<SemanticTokens | SemanticTokensEdits>;
  }

  /**
   * The document range semantic tokens provider interface defines the contract between extensions and
   * semantic tokens.
   */
  export interface DocumentRangeSemanticTokensProvider {
    /**
     * @see [provideDocumentSemanticTokens](#DocumentSemanticTokensProvider.provideDocumentSemanticTokens).
     */
    provideDocumentRangeSemanticTokens(document: TextDocument, range: Range, token: CancellationToken): ProviderResult<SemanticTokens>;
  }

  //#endregion Semantic Tokens

  /**
   * The configuration scope which can be a
   * a 'resource' or a languageId or both or
   * a '[TextDocument](#TextDocument)' or
   * a '[WorkspaceFolder](#WorkspaceFolder)'
   */
  export type ConfigurationScope = Uri | TextDocument | WorkspaceFolder | { uri?: Uri, languageId: string };
  //#region EvaluatableExpression

  /**
   * An EvaluatableExpression represents an expression in a document that can be evaluated by an active debugger or runtime.
   * The result of this evaluation is shown in a tooltip-like widget.
   * If only a range is specified, the expression will be extracted from the underlying document.
   * An optional expression can be used to override the extracted expression.
   * In this case the range is still used to highlight the range in the document.
   */
  export class EvaluatableExpression {

    /*
     * The range is used to extract the evaluatable expression from the underlying document and to highlight it.
     */
    readonly range: Range;

    /*
     * If specified the expression overrides the extracted expression.
     */
    readonly expression?: string;

    /**
     * Creates a new evaluatable expression object.
     *
     * @param range The range in the underlying document from which the evaluatable expression is extracted.
     * @param expression If specified overrides the extracted expression.
     */
    constructor(range: Range, expression?: string);
  }

  /**
   * The evaluatable expression provider interface defines the contract between extensions and
   * the debug hover. In this contract the provider returns an evaluatable expression for a given position
   * in a document and VS Code evaluates this expression in the active debug session and shows the result in a debug hover.
   */
  export interface EvaluatableExpressionProvider {

    /**
     * Provide an evaluatable expression for the given document and position.
     * VS Code will evaluate this expression in the active debug session and will show the result in the debug hover.
     * The expression can be implicitly specified by the range in the underlying document or by explicitly returning an expression.
     *
     * @param document The document for which the debug hover is about to appear.
     * @param position The line and character position in the document where the debug hover is about to appear.
     * @param token A cancellation token.
     * @return An EvaluatableExpression or a thenable that resolves to such. The lack of a result can be
     * signaled by returning `undefined` or `null`.
     */
    provideEvaluatableExpression(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<EvaluatableExpression>;
  }

  //#endregion

  //#region Inline Values
  /**
   * Provide inline value as text.
   */
  export class InlineValueText {
    /**
     * The document range for which the inline value applies.
     */
    readonly range: Range;
    /**
     * The text of the inline value.
     */
    readonly text: string;
    /**
     * Creates a new InlineValueText object.
     *
     * @param range The document line where to show the inline value.
     * @param text The value to be shown for the line.
     */
    constructor(range: Range, text: string);
  }

  /**
   * Provide inline value through a variable lookup.
   * If only a range is specified, the variable name will be extracted from the underlying document.
   * An optional variable name can be used to override the extracted name.
   */
  export class InlineValueVariableLookup {
    /**
     * The document range for which the inline value applies.
     * The range is used to extract the variable name from the underlying document.
     */
    readonly range: Range;
    /**
     * If specified the name of the variable to look up.
     */
    readonly variableName?: string;
    /**
     * How to perform the lookup.
     */
    readonly caseSensitiveLookup: boolean;
    /**
     * Creates a new InlineValueVariableLookup object.
     *
     * @param range The document line where to show the inline value.
     * @param variableName The name of the variable to look up.
     * @param caseSensitiveLookup How to perform the lookup. If missing lookup is case sensitive.
     */
    constructor(range: Range, variableName?: string, caseSensitiveLookup?: boolean);
  }

  /**
   * Provide an inline value through an expression evaluation.
   * If only a range is specified, the expression will be extracted from the underlying document.
   * An optional expression can be used to override the extracted expression.
   */
  export class InlineValueEvaluatableExpression {
    /**
     * The document range for which the inline value applies.
     * The range is used to extract the evaluatable expression from the underlying document.
     */
    readonly range: Range;
    /**
     * If specified the expression overrides the extracted expression.
     */
    readonly expression?: string;
    /**
     * Creates a new InlineValueEvaluatableExpression object.
     *
     * @param range The range in the underlying document from which the evaluatable expression is extracted.
     * @param expression If specified overrides the extracted expression.
     */
    constructor(range: Range, expression?: string);
  }

  /**
   * Inline value information can be provided by different means:
   * - directly as a text value (class InlineValueText).
   * - as a name to use for a variable lookup (class InlineValueVariableLookup)
   * - as an evaluatable expression (class InlineValueEvaluatableExpression)
   * The InlineValue types combines all inline value types into one type.
   */
  export type InlineValue = InlineValueText | InlineValueVariableLookup | InlineValueEvaluatableExpression;

  /**
   * A value-object that contains contextual information when requesting inline values from a InlineValuesProvider.
   */
  export interface InlineValueContext {

    /**
     * The stack frame (as a DAP Id) where the execution has stopped.
     */
    readonly frameId: number;

    /**
     * The document range where execution has stopped.
     * Typically the end position of the range denotes the line where the inline values are shown.
     */
    readonly stoppedLocation: Range;
  }

  /**
   * The inline values provider interface defines the contract between extensions and the VS Code debugger inline values feature.
   * In this contract the provider returns inline value information for a given document range
   * and VS Code shows this information in the editor at the end of lines.
   */
  export interface InlineValuesProvider {

    /**
     * An optional event to signal that inline values have changed.
     * @see [EventEmitter](#EventEmitter)
     */
    onDidChangeInlineValues?: Event<void> | undefined;

    /**
     * Provide "inline value" information for a given document and range.
     * VS Code calls this method whenever debugging stops in the given document.
     * The returned inline values information is rendered in the editor at the end of lines.
     *
     * @param document The document for which the inline values information is needed.
     * @param viewPort The visible document range for which inline values should be computed.
     * @param context A bag containing contextual information like the current location.
     * @param token A cancellation token.
     * @return An array of InlineValueDescriptors or a thenable that resolves to such. The lack of a result can be
     * signaled by returning `undefined` or `null`.
     */
    provideInlineValues(document: TextDocument, viewPort: Range, context: InlineValueContext, token: CancellationToken): ProviderResult<InlineValue[]>;
  }
  //#endregion Inline Values
}

/**
 * Thenable is a common denominator between ES6 promises, Q, jquery.Deferred, WinJS.Promise,
 * and others. This API makes no assumption about what promise library is being used which
 * enables reusing existing code without migrating to a specific promise implementation. Still,
 * we recommend the use of native promises which are available in this editor.
 */
interface Thenable<T> {
  /**
  * Attaches callbacks for the resolution and/or rejection of the Promise.
  * @param onfulfilled The callback to execute when the Promise is resolved.
  * @param onrejected The callback to execute when the Promise is rejected.
  * @returns A Promise for the completion of which ever callback is executed.
  */
  then<TResult>(onfulfilled?: (value: T) => TResult | Thenable<TResult>, onrejected?: (reason: any) => TResult | Thenable<TResult>): Thenable<TResult>;
  /* tslint:disable-next-line */
  then<TResult>(onfulfilled?: (value: T) => TResult | Thenable<TResult>, onrejected?: (reason: any) => void): Thenable<TResult>;
}

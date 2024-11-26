declare module 'vscode' {
  /**
   * Configuration for a debug session.
   */
  export interface DebugConfiguration {
    /**
     * The type of the debug session.
     */
    type: string;

    /**
     * The name of the debug session.
     */
    name: string;

    /**
     * The request type of the debug session.
     */
    request: string;

    /**
     * Additional debug type specific properties.
     */
    [key: string]: any;
  }

  /**
   * A debug session.
   */
  export interface DebugSession {
    /**
     * The unique ID of this debug session.
     */
    readonly id: string;

    /**
     * The debug session's type from the [debug configuration](#DebugConfiguration).
     */
    readonly type: string;

    /**
     * The parent session of this debug session, if it was created as a child.
     * @see DebugSessionOptions.parentSession
     */
    readonly parentSession?: DebugSession;

    /**
     * The debug session's name from the [debug configuration](#DebugConfiguration).
     */
    readonly name: string;

    /**
     * The workspace folder of this session or `undefined` for a folderless setup.
     */
    readonly workspaceFolder: WorkspaceFolder | undefined;

    /**
     * The "resolved" [debug configuration](#DebugConfiguration) of this session.
     * "Resolved" means that
     * - all variables have been substituted and
     * - platform specific attribute sections have been "flattened" for the matching platform and removed for non-matching platforms.
     */
    readonly configuration: DebugConfiguration;

    /**
     * Send a custom request to the debug adapter.
     */
    customRequest(command: string, args?: any): Thenable<any>;

    /**
     * Maps a VS Code breakpoint to the corresponding Debug Adapter Protocol (DAP) breakpoint that is managed by the debug adapter of the debug session.
     * If no DAP breakpoint exists (either because the VS Code breakpoint was not yet registered or because the debug adapter is not interested in the breakpoint), the value `undefined` is returned.
     *
     * @param breakpoint A VS Code [breakpoint](#Breakpoint).
     * @return A promise that resolves to the Debug Adapter Protocol breakpoint or `undefined`.
     */
    getDebugProtocolBreakpoint(breakpoint: Breakpoint): Thenable<DebugProtocolBreakpoint | undefined>;
  }

  /**
   * A custom Debug Adapter Protocol event received from a [debug session](#DebugSession).
   */
  export interface DebugSessionCustomEvent {
    /**
     * The [debug session](#DebugSession) for which the custom event was received.
     */
    readonly session: DebugSession;

    /**
     * Type of event.
     */
    readonly event: string;

    /**
     * Event specific information.
     */
    readonly body?: any;
  }

  /**
   * A debug configuration provider allows to add the initial debug configurations to a newly created launch.json
   * and to resolve a launch configuration before it is used to start a new debug session.
   * A debug configuration provider is registered via #debug.registerDebugConfigurationProvider.
   */
  export interface DebugConfigurationProvider {
    /**
     * Provides initial [debug configuration](#DebugConfiguration). If more than one debug configuration provider is
     * registered for the same type, debug configurations are concatenated in arbitrary order.
     *
     * @param folder The workspace folder for which the configurations are used or `undefined` for a folderless setup.
     * @param token A cancellation token.
     * @return An array of [debug configurations](#DebugConfiguration).
     */
    provideDebugConfigurations?(
      folder: WorkspaceFolder | undefined,
      token?: CancellationToken
    ): ProviderResult<DebugConfiguration[]>;

    /**
     * Resolves a [debug configuration](#DebugConfiguration) by filling in missing values or by adding/changing/removing attributes.
     * If more than one debug configuration provider is registered for the same type, the resolveDebugConfiguration calls are chained
     * in arbitrary order and the initial debug configuration is piped through the chain.
     * Returning the value 'undefined' prevents the debug session from starting.
     * Returning the value 'null' prevents the debug session from starting and opens the underlying debug configuration instead.
     *
     * @param folder The workspace folder from which the configuration originates from or `undefined` for a folderless setup.
     * @param debugConfiguration The [debug configuration](#DebugConfiguration) to resolve.
     * @param token A cancellation token.
     * @return The resolved debug configuration or undefined or null.
     */
    resolveDebugConfiguration?(
      folder: WorkspaceFolder | undefined,
      debugConfiguration: DebugConfiguration,
      token?: CancellationToken
    ): ProviderResult<DebugConfiguration>;

    /**
     * This hook is directly called after 'resolveDebugConfiguration' but with all variables substituted.
     * It can be used to resolve or verify a [debug configuration](#DebugConfiguration) by filling in missing values or by adding/changing/removing attributes.
     * If more than one debug configuration provider is registered for the same type, the 'resolveDebugConfigurationWithSubstitutedVariables' calls are chained
     * in arbitrary order and the initial debug configuration is piped through the chain.
     * Returning the value 'undefined' prevents the debug session from starting.
     * Returning the value 'null' prevents the debug session from starting and opens the underlying debug configuration instead.
     *
     * @param folder The workspace folder from which the configuration originates from or `undefined` for a folderless setup.
     * @param debugConfiguration The [debug configuration](#DebugConfiguration) to resolve.
     * @param token A cancellation token.
     * @return The resolved debug configuration or undefined or null.
     */
    resolveDebugConfigurationWithSubstitutedVariables?(
      folder: WorkspaceFolder | undefined,
      debugConfiguration: DebugConfiguration,
      token?: CancellationToken
    ): ProviderResult<DebugConfiguration>;
  }

  /**
   * Represents a debug adapter executable and optional arguments and runtime options passed to it.
   */
  export class DebugAdapterExecutable {
    /**
     * Creates a description for a debug adapter based on an executable program.
     *
     * @param command The command or executable path that implements the debug adapter.
     * @param args Optional arguments to be passed to the command or executable.
     * @param options Optional options to be used when starting the command or executable.
     */
    constructor(
      command: string,
      args?: string[],
      options?: DebugAdapterExecutableOptions
    );

    /**
     * The command or path of the debug adapter executable.
     * A command must be either an absolute path of an executable or the name of an command to be looked up via the PATH environment variable.
     * The special value 'node' will be mapped to VS Code's built-in Node.js runtime.
     */
    readonly command: string;

    /**
     * The arguments passed to the debug adapter executable. Defaults to an empty array.
     */
    readonly args: string[];

    /**
     * Optional options to be used when the debug adapter is started.
     * Defaults to undefined.
     */
    readonly options?: DebugAdapterExecutableOptions;
  }

  /**
   * Options for a debug adapter executable.
   */
  export interface DebugAdapterExecutableOptions {
    /**
     * The additional environment of the executed program or shell. If omitted
     * the parent process' environment is used. If provided it is merged with
     * the parent process' environment.
     */
    env?: { [key: string]: string };

    /**
     * The current working directory for the executed debug adapter.
     */
    cwd?: string;
  }

  /**
   * Represents a debug adapter running as a socket based server.
   */
  export class DebugAdapterServer {
    /**
     * The port.
     */
    readonly port: number;

    /**
     * The host.
     */
    readonly host?: string;

    /**
     * Create a description for a debug adapter running as a socket based server.
     */
    constructor(port: number, host?: string);
  }

  /**
   * Represents a debug adapter running as a Named Pipe (on Windows)/UNIX Domain Socket (on non-Windows) based server.
   */
  export class DebugAdapterNamedPipeServer {
    /**
     * The path to the NamedPipe/UNIX Domain Socket.
     */
    readonly path: string;

    /**
     * Create a description for a debug adapter running as a socket based server.
     */
    constructor(path: string);
  }

  /**
   * A debug adapter that implements the Debug Adapter Protocol can be registered with VS Code if it implements the DebugAdapter interface.
   */
  export interface DebugAdapter extends Disposable {
    /**
     * An event which fires after the debug adapter has sent a Debug Adapter Protocol message to VS Code.
     * Messages can be requests, responses, or events.
     */
    readonly onDidSendMessage: Event<DebugProtocolMessage>;

    /**
     * Handle a Debug Adapter Protocol message.
     * Messages can be requests, responses, or events.
     * Results or errors are returned via onSendMessage events.
     * @param message A Debug Adapter Protocol message
     */
    handleMessage(message: DebugProtocolMessage): void;
  }

  /**
   * A DebugProtocolMessage is an opaque stand-in type for the [ProtocolMessage](https://microsoft.github.io/debug-adapter-protocol/specification#Base_Protocol_ProtocolMessage) type defined in the Debug Adapter Protocol.
   */
  export interface DebugProtocolMessage {
    // Properties: see details [here](https://microsoft.github.io/debug-adapter-protocol/specification#Base_Protocol_ProtocolMessage).
  }

  /**
   * A debug adapter descriptor for an inline implementation.
   */
  export class DebugAdapterInlineImplementation {
    /**
     * Create a descriptor for an inline implementation of a debug adapter.
     */
    constructor(implementation: DebugAdapter);
  }

  export type DebugAdapterDescriptor =
    | DebugAdapterExecutable
    | DebugAdapterServer
    | DebugAdapterNamedPipeServer
    | DebugAdapterInlineImplementation;

  export interface DebugAdapterDescriptorFactory {
    /**
     * 'createDebugAdapterDescriptor' is called at the start of a debug session to provide details about the debug adapter to use.
     * These details must be returned as objects of type [DebugAdapterDescriptor](#DebugAdapterDescriptor).
     * Currently two types of debug adapters are supported:
     * - a debug adapter executable is specified as a command path and arguments (see [DebugAdapterExecutable](#DebugAdapterExecutable)),
     * - a debug adapter server reachable via a communication port (see [DebugAdapterServer](#DebugAdapterServer)).
     * If the method is not implemented the default behavior is this:
     *   createDebugAdapter(session: DebugSession, executable: DebugAdapterExecutable) {
     *      if (typeof session.configuration.debugServer === 'number') {
     *         return new DebugAdapterServer(session.configuration.debugServer);
     *      }
     *      return executable;
     *   }
     * @param session The [debug session](#DebugSession) for which the debug adapter will be used.
     * @param executable The debug adapter's executable information as specified in the package.json (or undefined if no such information exists).
     * @return a [debug adapter descriptor](#DebugAdapterDescriptor) or undefined.
     */
    createDebugAdapterDescriptor(
      session: DebugSession,
      executable: DebugAdapterExecutable | undefined
    ): ProviderResult<DebugAdapterDescriptor>;
  }

  /**
   * A Debug Adapter Tracker is a means to track the communication between VS Code and a Debug Adapter.
   */
  export interface DebugAdapterTracker {
    /**
     * A session with the debug adapter is about to be started.
     */
    onWillStartSession?(): void;
    /**
     * The debug adapter is about to receive a Debug Adapter Protocol message from VS Code.
     */
    onWillReceiveMessage?(message: any): void;
    /**
     * The debug adapter has sent a Debug Adapter Protocol message to VS Code.
     */
    onDidSendMessage?(message: any): void;
    /**
     * The debug adapter session is about to be stopped.
     */
    onWillStopSession?(): void;
    /**
     * An error with the debug adapter has occurred.
     */
    onError?(error: Error): void;
    /**
     * The debug adapter has exited with the given exit code or signal.
     */
    onExit?(code: number | undefined, signal: string | undefined): void;
  }

  export interface DebugAdapterTrackerFactory {
    /**
     * The method 'createDebugAdapterTracker' is called at the start of a debug session in order
     * to return a "tracker" object that provides read-access to the communication between VS Code and a debug adapter.
     *
     * @param session The [debug session](#DebugSession) for which the debug adapter tracker will be used.
     * @return A [debug adapter tracker](#DebugAdapterTracker) or undefined.
     */
    createDebugAdapterTracker(
      session: DebugSession
    ): ProviderResult<DebugAdapterTracker>;
  }

  /**
   * Represents the debug console.
   */
  export interface DebugConsole {
    /**
     * Append the given value to the debug console.
     *
     * @param value A string, falsy values will not be printed.
     */
    append(value: string): void;

    /**
     * Append the given value and a line feed character
     * to the debug console.
     *
     * @param value A string, falsy values will be printed.
     */
    appendLine(value: string): void;
  }

  /**
   * An event describing the changes to the set of [breakpoints](#Breakpoint).
   */
  export interface BreakpointsChangeEvent {
    /**
     * Added breakpoints.
     */
    readonly added: ReadonlyArray<Breakpoint>;

    /**
     * Removed breakpoints.
     */
    readonly removed: ReadonlyArray<Breakpoint>;

    /**
     * Changed breakpoints.
     */
    readonly changed: ReadonlyArray<Breakpoint>;
  }

  /**
   * The base class of all breakpoint types.
   */
  export class Breakpoint {
    /**
     * The unique ID of the breakpoint.
     */
    readonly id: string;
    /**
     * Is breakpoint enabled.
     */
    readonly enabled: boolean;
    /**
     * An optional expression for conditional breakpoints.
     */
    readonly condition?: string;
    /**
     * An optional expression that controls how many hits of the breakpoint are ignored.
     */
    readonly hitCondition?: string;
    /**
     * An optional message that gets logged when this breakpoint is hit. Embedded expressions within {} are interpolated by the debug adapter.
     */
    readonly logMessage?: string;

    protected constructor(
      enabled?: boolean,
      condition?: string,
      hitCondition?: string,
      logMessage?: string
    );
  }

  /**
   * A breakpoint specified by a source location.
   */
  export class SourceBreakpoint extends Breakpoint {
    /**
     * The source and line position of this breakpoint.
     */
    readonly location: Location;

    /**
     * Create a new breakpoint for a source location.
     */
    constructor(
      location: Location,
      enabled?: boolean,
      condition?: string,
      hitCondition?: string,
      logMessage?: string
    );
  }

  /**
   * A breakpoint specified by a function name.
   */
  export class FunctionBreakpoint extends Breakpoint {
    /**
     * The name of the function to which this breakpoint is attached.
     */
    readonly functionName: string;

    /**
     * Create a new function breakpoint.
     */
    constructor(
      functionName: string,
      enabled?: boolean,
      condition?: string,
      hitCondition?: string,
      logMessage?: string
    );
  }

  /**
   * Debug console mode used by debug session, see [options](#DebugSessionOptions).
   */
  export enum DebugConsoleMode {
    /**
     * Debug session should have a separate debug console.
     */
    Separate = 0,

    /**
     * Debug session should share debug console with its parent session.
     * This value has no effect for sessions which do not have a parent session.
     */
    MergeWithParent = 1,
  }

  /**
   * Options for [starting a debug session](#debug.startDebugging).
   */
  export interface DebugSessionOptions {
    /**
     * When specified the newly created debug session is registered as a "child" session of this
     * "parent" debug session.
     */
    parentSession?: DebugSession;

    /**
     * Controls whether lifecycle requests like 'restart' are sent to the newly created session or its parent session.
     * By default (if the property is false or missing), lifecycle requests are sent to the new session.
     * This property is ignored if the session has no parent session.
     */
    lifecycleManagedByParent?: boolean;

    /**
     * Controls whether this session should have a separate debug console or share it
     * with the parent session. Has no effect for sessions which do not have a parent session.
     * Defaults to Separate.
     */
    consoleMode?: DebugConsoleMode;

    /**
     * Controls whether this session should run without debugging, thus ignoring breakpoints.
     * When this property is not specified, the value from the parent session (if there is one) is used.
     */
    noDebug?: boolean;

    /**
     * Controls if the debug session's parent session is shown in the CALL STACK view even if it has only a single child.
     * By default, the debug session will never hide its parent.
     * If compact is true, debug sessions with a single child are hidden in the CALL STACK view to make the tree more compact.
     */
    compact?: boolean;

    /**
     * When true, a save will not be triggered for open editors when starting a debug session,
     * regardless of the value of the `debug.saveBeforeStart` setting.
     */
    suppressSaveBeforeStart?: boolean;

    /**
     * When true, the debug toolbar will not be shown for this session.
     */
    suppressDebugToolbar?: boolean;

    /**
     * When true, the window statusbar color will not be changed for this session.
     */
    suppressDebugStatusbar?: boolean;

    /**
     * When true, the debug viewlet will not be automatically revealed for this session.
     */
    suppressDebugView?: boolean;
    /**
     * Signals to the editor that the debug session was started from a test run
     * request. This is used to link the lifecycle of the debug session and
     * test run in UI actions.
     */
    testRun?: TestRun;
  }

  /**
   * A DebugConfigurationProviderTriggerKind specifies when the `provideDebugConfigurations` method of a `DebugConfigurationProvider` is triggered.
   * Currently there are two situations: to provide the initial debug configurations for a newly created launch.json or
   * to provide dynamically generated debug configurations when the user asks for them through the UI (e.g. via the "Select and Start Debugging" command).
   * A trigger kind is used when registering a `DebugConfigurationProvider` with #debug.registerDebugConfigurationProvider.
   */
  export enum DebugConfigurationProviderTriggerKind {
    /**
     *  `DebugConfigurationProvider.provideDebugConfigurations` is called to provide the initial debug configurations for a newly created launch.json.
     */
    Initial = 1,
    /**
     * `DebugConfigurationProvider.provideDebugConfigurations` is called to provide dynamically generated debug configurations when the user asks for them through the UI (e.g. via the "Select and Start Debugging" command).
     */
    Dynamic = 2
  }

  /**
   * A DebugProtocolSource is an opaque stand-in type for the [Source](https://microsoft.github.io/debug-adapter-protocol/specification#Types_Source) type defined in the Debug Adapter Protocol.
   */
  export interface DebugProtocolSource {
    // Properties: see details [here](https://microsoft.github.io/debug-adapter-protocol/specification#Types_Source).
  }

  /**
   * A DebugProtocolBreakpoint is an opaque stand-in type for the [Breakpoint](https://microsoft.github.io/debug-adapter-protocol/specification#Types_Breakpoint) type defined in the Debug Adapter Protocol.
   */
  export interface DebugProtocolBreakpoint {
    // Properties: see details [here](https://microsoft.github.io/debug-adapter-protocol/specification#Types_Breakpoint).
  }

  /**
   * An item from the {@link DebugVisualizationTree}
   */
  export interface DebugTreeItem {
    /**
     * A human-readable string describing this item.
     */
    label: string;

    /**
     * A human-readable string which is rendered less prominent.
     */
    description?: string;

    /**
     * {@link TreeItemCollapsibleState} of the tree item.
     */
    collapsibleState?: TreeItemCollapsibleState;

    /**
     * Context value of the tree item. This can be used to contribute item specific actions in the tree.
     * For example, a tree item is given a context value as `folder`. When contributing actions to `view/item/context`
     * using `menus` extension point, you can specify context value for key `viewItem` in `when` expression like `viewItem == folder`.
     * ```json
     * "contributes": {
     *   "menus": {
     *     "view/item/context": [
     *       {
     *         "command": "extension.deleteFolder",
     *         "when": "viewItem == folder"
     *       }
     *     ]
     *   }
     * }
     * ```
     * This will show action `extension.deleteFolder` only for items with `contextValue` is `folder`.
     */
    contextValue?: string;

    /**
     * Whether this item can be edited by the user.
     */
    canEdit?: boolean;
  }

  /**
   * Provides a tree that can be referenced in debug visualizations.
   */
  export interface DebugVisualizationTree<T extends DebugTreeItem = DebugTreeItem> {
    /**
     * Gets the tree item for an element or the base context item.
     */
    getTreeItem(context: DebugVisualizationContext): ProviderResult<T>;
    /**
     * Gets children for the tree item or the best context item.
     */
    getChildren(element: T): ProviderResult<T[]>;
    /**
     * Handles the user editing an item.
     */
    editItem?(item: T, value: string): ProviderResult<T>;
  }

  export class DebugVisualization {
    /**
     * The name of the visualization to show to the user.
     */
    name: string;

    /**
     * An icon for the view when it's show in inline actions.
     */
    iconPath?: Uri | { light: Uri; dark: Uri } | ThemeIcon;

    /**
     * Visualization to use for the variable. This may be either:
     * - A command to run when the visualization is selected for a variable.
     * - A reference to a previously-registered {@link DebugVisualizationTree}
     */
    visualization?: Command | { treeId: string };

    /**
     * Creates a new debug visualization object.
     * @param name Name of the visualization to show to the user.
     */
    constructor(name: string);
  }

  export interface DebugVisualizationProvider<T extends DebugVisualization = DebugVisualization> {
    /**
     * Called for each variable when the debug session stops. It should return
     * any visualizations the extension wishes to show to the user.
     *
     * Note that this is only called when its `when` clause defined under the
     * `debugVisualizers` contribution point in the `package.json` evaluates
     * to true.
     */
    provideDebugVisualization(context: DebugVisualizationContext, token: CancellationToken): ProviderResult<T[]>;

    /**
     * Invoked for a variable when a user picks the visualizer.
     *
     * It may return a {@link TreeView} that's shown in the Debug Console or
     * inline in a hover. A visualizer may choose to return `undefined` from
     * this function and instead trigger other actions in the UI, such as opening
     * a custom {@link WebviewView}.
     */
    resolveDebugVisualization?(visualization: T, token: CancellationToken): ProviderResult<T>;
  }

  export interface DebugVisualizationContext {
    /**
     * The Debug Adapter Protocol Variable to be visualized.
     * @see https://microsoft.github.io/debug-adapter-protocol/specification#Types_Variable
     */
    variable: any;
    /**
     * The Debug Adapter Protocol variable reference the type (such as a scope
     * or another variable) that contained this one. Empty for variables
     * that came from user evaluations in the Debug Console.
     * @see https://microsoft.github.io/debug-adapter-protocol/specification#Types_Variable
     */
    containerId?: number;
    /**
     * The ID of the Debug Adapter Protocol StackFrame in which the variable was found,
     * for variables that came from scopes in a stack frame.
     * @see https://microsoft.github.io/debug-adapter-protocol/specification#Types_StackFrame
     */
    frameId?: number;
    /**
     * The ID of the Debug Adapter Protocol Thread in which the variable was found.
     * @see https://microsoft.github.io/debug-adapter-protocol/specification#Types_StackFrame
     */
    threadId: number;
    /**
     * The debug session the variable belongs to.
     */
    session: DebugSession;
  }

  /**
   * Namespace for debug functionality.
   */
  export namespace debug {
    /**
     * The currently active [debug session](#DebugSession) or `undefined`. The active debug session is the one
     * represented by the debug action floating window or the one currently shown in the drop down menu of the debug action floating window.
     * If no debug session is active, the value is `undefined`.
     */
    export let activeDebugSession: DebugSession | undefined;

    /**
     * The currently active [debug console](#DebugConsole).
     * If no debug session is active, output sent to the debug console is not shown.
     */
    export let activeDebugConsole: DebugConsole;

    /**
     * List of breakpoints.
     */
    export let breakpoints: Breakpoint[];

    /**
     * An [event](#Event) which fires when the [active debug session](#debug.activeDebugSession)
     * has changed. *Note* that the event also fires when the active debug session changes
     * to `undefined`.
     */
    export const onDidChangeActiveDebugSession: Event<DebugSession | undefined>;

    /**
     * An [event](#Event) which fires when a new [debug session](#DebugSession) has been started.
     */
    export const onDidStartDebugSession: Event<DebugSession>;

    /**
     * An [event](#Event) which fires when a custom DAP event is received from the [debug session](#DebugSession).
     */
    export const onDidReceiveDebugSessionCustomEvent: Event<DebugSessionCustomEvent>;

    /**
     * An [event](#Event) which fires when a [debug session](#DebugSession) has terminated.
     */
    export const onDidTerminateDebugSession: Event<DebugSession>;

    /**
     * An [event](#Event) that is emitted when the set of breakpoints is added, removed, or changed.
     */
    export const onDidChangeBreakpoints: Event<BreakpointsChangeEvent>;

    /**
     * Register a [debug configuration provider](#DebugConfigurationProvider) for a specific debug type.
     * The optional [triggerKind](#DebugConfigurationProviderTriggerKind) can be used to specify when the `provideDebugConfigurations` method of the provider is triggered.
     * Currently two trigger kinds are possible: with the value `Initial` (or if no trigger kind argument is given) the `provideDebugConfigurations` method is used to provide the initial debug configurations to be copied into a newly created launch.json.
     * With the trigger kind `Dynamic` the `provideDebugConfigurations` method is used to dynamically determine debug configurations to be presented to the user (in addition to the static configurations from the launch.json).
     * Please note that the `triggerKind` argument only applies to the `provideDebugConfigurations` method: so the `resolveDebugConfiguration` methods are not affected at all.
     * Registering a single provider with resolve methods for different trigger kinds, results in the same resolve methods called multiple times.
     * More than one provider can be registered for the same type.
     *
     * @param type The debug type for which the provider is registered.
     * @param provider The [debug configuration provider](#DebugConfigurationProvider) to register.
     * @param triggerKind The [trigger](#DebugConfigurationProviderTrigger) for which the 'provideDebugConfiguration' method of the provider is registered. If `triggerKind` is missing, the value `DebugConfigurationProviderTriggerKind.Initial` is assumed.
     * @return A [disposable](#Disposable) that unregisters this provider when being disposed.
     */
    export function registerDebugConfigurationProvider(
      debugType: string,
      provider: DebugConfigurationProvider,
      triggerKind?: DebugConfigurationProviderTriggerKind
    ): Disposable;

    /**
     * Register a [debug adapter descriptor factory](#DebugAdapterDescriptorFactory) for a specific debug type.
     * An extension is only allowed to register a DebugAdapterDescriptorFactory for the debug type(s) defined by the extension. Otherwise an error is thrown.
     * Registering more than one DebugAdapterDescriptorFactory for a debug type results in an error.
     *
     * @param debugType The debug type for which the factory is registered.
     * @param factory The [debug adapter descriptor factory](#DebugAdapterDescriptorFactory) to register.
     * @return A [disposable](#Disposable) that unregisters this factory when being disposed.
     */
    export function registerDebugAdapterDescriptorFactory(
      debugType: string,
      factory: DebugAdapterDescriptorFactory
    ): Disposable;

    /**
     * Register a debug adapter tracker factory for the given debug type.
     *
     * @param debugType The debug type for which the factory is registered or '*' for matching all debug types.
     * @param factory The [debug adapter tracker factory](#DebugAdapterTrackerFactory) to register.
     * @return A [disposable](#Disposable) that unregisters this factory when being disposed.
     */
    export function registerDebugAdapterTrackerFactory(
      debugType: string,
      factory: DebugAdapterTrackerFactory
    ): Disposable;

    /**
     * Start debugging by using either a named launch or named compound configuration,
     * or by directly passing a [DebugConfiguration](#DebugConfiguration).
     * The named configurations are looked up in '.vscode/launch.json' found in the given folder.
     * Before debugging starts, all unsaved files are saved and the launch configurations are brought up-to-date.
     * Folder specific variables used in the configuration (e.g. '${workspaceFolder}') are resolved against the given folder.
     * @param folder The [workspace folder](#WorkspaceFolder) for looking up named configurations and resolving variables or `undefined` for a non-folder setup.
     * @param nameOrConfiguration Either the name of a debug or compound configuration or a [DebugConfiguration](#DebugConfiguration) object.
     * @param parent If specified the newly created debug session is registered as a "child" session of a "parent" debug session.
     * @return A thenable that resolves when debugging could be successfully started.
     */
    export function startDebugging(
      folder: WorkspaceFolder | undefined,
      nameOrConfiguration: string | DebugConfiguration,
      parentSessionOrOptions?: DebugSession | DebugSessionOptions
    ): Thenable<boolean>;

    /**
     * Stop the given debug session or stop all debug sessions if session is omitted.
     * @param session The [debug session](#DebugSession) to stop; if omitted all sessions are stopped.
     */
    export function stopDebugging(session?: DebugSession): Thenable<void>;

    /**
     * Add breakpoints.
     * @param breakpoints The breakpoints to add.
     */
    export function addBreakpoints(breakpoints: Breakpoint[]): void;

    /**
     * Remove breakpoints.
     * @param breakpoints The breakpoints to remove.
     */
    export function removeBreakpoints(breakpoints: Breakpoint[]): void;

    /**
     * Converts a "Source" descriptor object received via the Debug Adapter Protocol into a Uri that can be used to load its contents.
     * If the source descriptor is based on a path, a file Uri is returned.
     * If the source descriptor uses a reference number, a specific debug Uri (scheme 'debug') is constructed that requires a corresponding VS Code ContentProvider and a running debug session
     *
     * If the "Source" descriptor has insufficient information for creating the Uri, an error is thrown.
     *
     * @param source An object conforming to the [Source](https://microsoft.github.io/debug-adapter-protocol/specification#Types_Source) type defined in the Debug Adapter Protocol.
     * @param session An optional debug session that will be used when the source descriptor uses a reference number to load the contents from an active debug session.
     * @return A uri that can be used to load the contents of the source.
     */
    export function asDebugSourceUri(source: DebugProtocolSource, session?: DebugSession): Uri;

    /**
     * Registers a custom data visualization for variables when debugging.
     *
     * @param id The corresponding ID in the package.json `debugVisualizers` contribution point.
     * @param provider The {@link DebugVisualizationProvider} to register
     */
    export function registerDebugVisualizationProvider<T extends DebugVisualization>(
      id: string,
      provider: DebugVisualizationProvider<T>
    ): Disposable;

    /**
     * Registers a tree that can be referenced by {@link DebugVisualization.visualization}.
     * @param id
     * @param provider
     */
    export function registerDebugVisualizationTreeProvider<T extends DebugTreeItem>(
      id: string,
      provider: DebugVisualizationTree<T>
    ): Disposable;
  }
}

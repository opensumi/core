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
     * Controls whether this session should have a separate debug console or share it
     * with the parent session. Has no effect for sessions which do not have a parent session.
     * Defaults to Separate.
     */
    consoleMode?: DebugConsoleMode;
  }

  /**
   * A DebugProtocolSource is an opaque stand-in type for the [Source](https://microsoft.github.io/debug-adapter-protocol/specification#Types_Source) type defined in the Debug Adapter Protocol.
   */
  export interface DebugProtocolSource {
    // Properties: see details [here](https://microsoft.github.io/debug-adapter-protocol/specification#Types_Source).
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
     * More than one provider can be registered for the same type.
     *
     * @param type The debug type for which the provider is registered.
     * @param provider The [debug configuration provider](#DebugConfigurationProvider) to register.
     * @return A [disposable](#Disposable) that unregisters this provider when being disposed.
     */
    export function registerDebugConfigurationProvider(
      debugType: string,
      provider: DebugConfigurationProvider
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
  }
}

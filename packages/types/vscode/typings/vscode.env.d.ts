declare module 'vscode' {
  /**
   * Namespace describing the environment the editor runs in.
   */
  export namespace env {

    /**
     * The application name of the editor, like 'VS Code'.
     */
    export const appName: string;

    /**
     * The application root folder from which the editor is running.
     *
     * *Note* that the value is the empty string when running in an
     * environment that has no representation of an application root folder.
     */
    export const appRoot: string;

    /**
     * The hosted location of the application
     * On desktop this is 'desktop'
     * In the web this is the specified embedder i.e. 'github.dev', 'codespaces', or 'web' if the embedder
     * does not provide that information
     */
    export const appHost: string;

    /**
     * The custom uri scheme the editor registers to in the operating system.
     */
    export const uriScheme: string;

    /**
     * Represents the preferred user-language, like `de-CH`, `fr`, or `en-US`.
     */
    export const language: string;

    /**
     * The system clipboard.
     */
    export const clipboard: Clipboard;

    /**
     * A unique identifier for the computer.
     */
    export const machineId: string;

    /**
     * A unique identifier for the current session.
     * Changes each time the editor is started.
     */
    export const sessionId: string;

    /**
     * Indicates that this is a fresh install of the application.
     * `true` if within the first day of installation otherwise `false`.
     */
    export const isNewAppInstall: boolean;

    /**
     * Indicates whether the users has telemetry enabled.
     * Can be observed to determine if the extension should send telemetry.
     */
    export const isTelemetryEnabled: boolean;

    /**
     * An [event](#Event) which fires when the user enabled or disables telemetry.
     * `true` if the user has enabled telemetry or `false` if the user has disabled telemetry.
     */
    export const onDidChangeTelemetryEnabled: Event<boolean>;

    /**
     * An {@link Event} which fires when the default shell changes. This fires with the new
     * shell path.
     */
    export const onDidChangeShell: Event<string>;

    /**
     * Creates a new {@link TelemetryLogger telemetry logger}.
     *
     * @param sender The telemetry sender that is used by the telemetry logger.
     * @param options Options for the telemetry logger.
     * @returns A new telemetry logger
     */
    export function createTelemetryLogger(sender: TelemetrySender, options?: TelemetryLoggerOptions): TelemetryLogger;

    /**
     * The name of a remote. Defined by extensions, popular samples are `wsl` for the Windows
     * Subsystem for Linux or `ssh-remote` for remotes using a secure shell.
     *
     * *Note* that the value is `undefined` when there is no remote extension host but that the
     * value is defined in all extension hosts (local and remote) in case a remote extension host
     * exists. Use [`Extension#extensionKind`](#Extension.extensionKind) to know if
     * a specific extension runs remote or not.
     */
    export const remoteName: string | undefined;

    /**
     * The UI kind property indicates from which UI extensions
     * are accessed from. For example, extensions could be accessed
     * from a desktop application or a web browser.
     */
    export const uiKind: UIKind;

    /**
     * The detected default shell for the extension host, this is overridden by the
     * `terminal.integrated.defaultProfile` setting for the extension host's platform. Note that in
     * environments that do not support a shell the value is the empty string.
     */
    export const shell: string;

    /**
     * Opens an *external* item, e.g. a http(s) or mailto-link, using the
     * default application.
     *
     * *Note* that [`showTextDocument`](#window.showTextDocument) is the right
     * way to open a text document inside the editor, not this function.
     *
     * @param target The uri that should be opened.
     * @returns A promise indicating if open was successful.
     */
    export function openExternal(target: Uri): Thenable<boolean>;

    /**
     * Resolves a uri to form that is accessible externally. Currently only supports `https:`, `http:` and
     * `vscode.env.uriScheme` uris.
     *
     * #### `http:` or `https:` scheme
     *
     * Resolves an *external* uri, such as a `http:` or `https:` link, from where the extension is running to a
     * uri to the same resource on the client machine.
     *
     * This is a no-op if the extension is running on the client machine.
     *
     * If the extension is running remotely, this function automatically establishes a port forwarding tunnel
     * from the local machine to `target` on the remote and returns a local uri to the tunnel. The lifetime of
     * the port fowarding tunnel is managed by VS Code and the tunnel can be closed by the user.
     *
     * *Note* that uris passed through `openExternal` are automatically resolved and you should not call `asExternalUri` on them.
     *
     * #### `vscode.env.uriScheme`
     *
     * Creates a uri that - if opened in a browser (e.g. via `openExternal`) - will result in a registered [UriHandler](#UriHandler)
     * to trigger.
     *
     * Extensions should not make any assumptions about the resulting uri and should not alter it in anyway.
     * Rather, extensions can e.g. use this uri in an authentication flow, by adding the uri as callback query
     * argument to the server to authenticate to.
     *
     * *Note* that if the server decides to add additional query parameters to the uri (e.g. a token or secret), it
     * will appear in the uri that is passed to the [UriHandler](#UriHandler).
     *
     * **Example** of an authentication flow:
     * ```typescript
     * vscode.window.registerUriHandler({
     *   handleUri(uri: vscode.Uri): vscode.ProviderResult<void> {
     *     if (uri.path === '/did-authenticate') {
     *       console.log(uri.toString());
     *     }
     *   }
     * });
     *
     * const callableUri = await vscode.env.asExternalUri(vscode.Uri.parse(`${vscode.env.uriScheme}://my.extension/did-authenticate`));
     * await vscode.env.openExternal(callableUri);
     * ```
     *
     * *Note* that extensions should not cache the result of `asExternalUri` as the resolved uri may become invalid due to
     * a system or user action — for example, in remote cases, a user may close a port forwarding tunnel that was opened by
     * `asExternalUri`.
     *
     * @return A uri that can be used on the client machine.
     */
    export function asExternalUri(target: Uri): Thenable<Uri>;
  }

  /**
   * A telemetry logger which can be used by extensions to log usage and error telemetry.
   *
   * A logger wraps around a {@link TelemetrySender sender} but it guarantees that
   * - user settings to disable or tweak telemetry are respected, and that
   * - potential sensitive data is removed
   *
   * It also enables an "echo UI" that prints whatever data is send and it allows the editor
   * to forward unhandled errors to the respective extensions.
   *
   * To get an instance of a `TelemetryLogger`, use
   * {@link env.createTelemetryLogger `createTelemetryLogger`}.
   */
  export interface TelemetryLogger {

    /**
     * An {@link Event} which fires when the enablement state of usage or error telemetry changes.
     */
    readonly onDidChangeEnableStates: Event<TelemetryLogger>;

    /**
     * Whether or not usage telemetry is enabled for this logger.
     */
    readonly isUsageEnabled: boolean;

    /**
     * Whether or not error telemetry is enabled for this logger.
     */
    readonly isErrorsEnabled: boolean;

    /**
     * Log a usage event.
     *
     * After completing cleaning, telemetry setting checks, and data mix-in calls `TelemetrySender.sendEventData` to log the event.
     * Automatically supports echoing to extension telemetry output channel.
     * @param eventName The event name to log
     * @param data The data to log
     */
    logUsage(eventName: string, data?: Record<string, any | TelemetryTrustedValue>): void;

    /**
     * Log an error event.
     *
     * After completing cleaning, telemetry setting checks, and data mix-in calls `TelemetrySender.sendEventData` to log the event. Differs from `logUsage` in that it will log the event if the telemetry setting is Error+.
     * Automatically supports echoing to extension telemetry output channel.
     * @param eventName The event name to log
     * @param data The data to log
     */
    logError(eventName: string, data?: Record<string, any | TelemetryTrustedValue>): void;

    /**
     * Log an error event.
     *
     * Calls `TelemetrySender.sendErrorData`. Does cleaning, telemetry checks, and data mix-in.
     * Automatically supports echoing to extension telemetry output channel.
     * Will also automatically log any exceptions thrown within the extension host process.
     * @param error The error object which contains the stack trace cleaned of PII
     * @param data Additional data to log alongside the stack trace
     */
    logError(error: Error, data?: Record<string, any | TelemetryTrustedValue>): void;

    /**
     * Dispose this object and free resources.
     */
    dispose(): void;
  }

  /**
   * The telemetry sender is the contract between a telemetry logger and some telemetry service. **Note** that extensions must NOT
   * call the methods of their sender directly as the logger provides extra guards and cleaning.
   *
   * ```js
   * const sender: vscode.TelemetrySender = {...};
   * const logger = vscode.env.createTelemetryLogger(sender);
   *
   * // GOOD - uses the logger
   * logger.logUsage('myEvent', { myData: 'myValue' });
   *
   * // BAD - uses the sender directly: no data cleansing, ignores user settings, no echoing to the telemetry output channel etc
   * sender.logEvent('myEvent', { myData: 'myValue' });
   * ```
   */
  export interface TelemetrySender {
    /**
     * Function to send event data without a stacktrace. Used within a {@link TelemetryLogger}
     *
     * @param eventName The name of the event which you are logging
     * @param data A serializable key value pair that is being logged
     */
    sendEventData(eventName: string, data?: Record<string, any>): void;

    /**
     * Function to send an error. Used within a {@link TelemetryLogger}
     *
     * @param error The error being logged
     * @param data Any additional data to be collected with the exception
     */
    sendErrorData(error: Error, data?: Record<string, any>): void;

    /**
     * Optional flush function which will give this sender a chance to send any remaining events
     * as its {@link TelemetryLogger} is being disposed
     */
    flush?(): void | Thenable<void>;
  }

  /**
   * Options for creating a {@link TelemetryLogger}
   */
  export interface TelemetryLoggerOptions {
    /**
     * Whether or not you want to avoid having the built-in common properties such as os, extension name, etc injected into the data object.
     * Defaults to `false` if not defined.
     */
    readonly ignoreBuiltInCommonProperties?: boolean;

    /**
     * Whether or not unhandled errors on the extension host caused by your extension should be logged to your sender.
     * Defaults to `false` if not defined.
     */
    readonly ignoreUnhandledErrors?: boolean;

    /**
     * Any additional common properties which should be injected into the data object.
     */
    readonly additionalCommonProperties?: Record<string, any>;
  }

}

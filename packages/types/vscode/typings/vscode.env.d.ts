/**
 * API OWENR: 墨蛰
 */

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
     */
    export const appRoot: string;

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
     * `terminal.integrated.shell` setting for the extension host's platform.
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

}

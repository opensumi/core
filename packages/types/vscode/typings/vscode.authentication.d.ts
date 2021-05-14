declare module 'vscode' {
  /**
   * Represents a session of a currently logged in user.
   */
  export interface AuthenticationSession {
    /**
     * The identifier of the authentication session.
     */
    readonly id: string;

    /**
     * The access token.
     */
    readonly accessToken: string;

    /**
     * The account associated with the session.
     */
    readonly account: AuthenticationSessionAccountInformation;

    /**
     * The permissions granted by the session's access token. Available scopes
     * are defined by the {@link AuthenticationProvider}.
     */
    readonly scopes: ReadonlyArray<string>;
  }

  /**
   * The information of an account associated with an {@link AuthenticationSession}.
   */
  export interface AuthenticationSessionAccountInformation {
    /**
     * The unique identifier of the account.
     */
    readonly id: string;

    /**
     * The human-readable name of the account.
     */
    readonly label: string;
  }


  /**
   * Options to be used when getting an {@link AuthenticationSession} from an {@link AuthenticationProvider}.
   */
  export interface AuthenticationGetSessionOptions {
    /**
     * Whether login should be performed if there is no matching session.
     *
     * If true, a modal dialog will be shown asking the user to sign in. If false, a numbered badge will be shown
     * on the accounts activity bar icon. An entry for the extension will be added under the menu to sign in. This
     * allows quietly prompting the user to sign in.
     *
     * If there is a matching session but the extension has not been granted access to it, setting this to true
     * will also result in an immediate modal dialog, and false will add a numbered badge to the accounts icon.
     *
     * Defaults to false.
     */
    createIfNone?: boolean;

    /**
     * Whether the existing user session preference should be cleared.
     *
     * For authentication providers that support being signed into multiple accounts at once, the user will be
     * prompted to select an account to use when {@link authentication.getSession getSession} is called. This preference
     * is remembered until {@link authentication.getSession getSession} is called with this flag.
     *
     * Defaults to false.
     */
    clearSessionPreference?: boolean;
  }

  /**
   * Basic information about an {@link AuthenticationProvider}
   */
  export interface AuthenticationProviderInformation {
    /**
     * The unique identifier of the authentication provider.
     */
    readonly id: string;

    /**
     * The human-readable name of the authentication provider.
     */
    readonly label: string;
  }

  /**
   * An {@link Event} which fires when an {@link AuthenticationSession} is added, removed, or changed.
   */
  export interface AuthenticationSessionsChangeEvent {
    /**
     * The {@link AuthenticationProvider} that has had its sessions change.
     */
    readonly provider: AuthenticationProviderInformation;
  }

  /**
   * Options for creating an {@link AuthenticationProvider}.
   */
  export interface AuthenticationProviderOptions {
    /**
     * Whether it is possible to be signed into multiple accounts at once with this provider.
     * If not specified, will default to false.
    */
    readonly supportsMultipleAccounts?: boolean;
  }

  /**
  * An {@link Event} which fires when an {@link AuthenticationSession} is added, removed, or changed.
  */
  export interface AuthenticationProviderAuthenticationSessionsChangeEvent {
    /**
     * The {@link AuthenticationSession}s of the {@link AuthentiationProvider AuthenticationProvider} that have been added.
    */
    readonly added?: ReadonlyArray<AuthenticationSession>;

    /**
     * The {@link AuthenticationSession}s of the {@link AuthentiationProvider AuthenticationProvider} that have been removed.
     */
    readonly removed?: ReadonlyArray<AuthenticationSession>;

    /**
     * The {@link AuthenticationSession}s of the {@link AuthentiationProvider AuthenticationProvider} that have been changed.
     * A session changes when its data excluding the id are updated. An example of this is a session refresh that results in a new
     * access token being set for the session.
     */
    readonly changed?: ReadonlyArray<AuthenticationSession>;
  }

  /**
   * A provider for performing authentication to a service.
   */
  export interface AuthenticationProvider {
    /**
     * An {@link Event} which fires when the array of sessions has changed, or data
     * within a session has changed.
     */
    readonly onDidChangeSessions: Event<AuthenticationProviderAuthenticationSessionsChangeEvent>;

    /**
     * Get a list of sessions.
     * @param scopes An optional list of scopes. If provided, the sessions returned should match
     * these permissions, otherwise all sessions should be returned.
     * @returns A promise that resolves to an array of authentication sessions.
     */
    getSessions(scopes?: string[]): Thenable<ReadonlyArray<AuthenticationSession>>;

    /**
     * Prompts a user to login.
     *
     * If login is successful, the onDidChangeSessions event should be fired.
     *
     * If login fails, a rejected promise should be returned.
     *
     * If the provider has specified that it does not support multiple accounts,
     * then this should never be called if there is already an existing session matching these
     * scopes.
     * @param scopes A list of scopes, permissions, that the new session should be created with.
     * @returns A promise that resolves to an authentication session.
     */
    createSession(scopes: string[]): Thenable<AuthenticationSession>;

    /**
     * Removes the session corresponding to session id.
     *
     * If the removal is successful, the onDidChangeSessions event should be fired.
     *
     * If a session cannot be removed, the provider should reject with an error message.
     * @param sessionId The id of the session to remove.
     */
    removeSession(sessionId: string): Thenable<void>;
  }


  /**
   * Namespace for authentication.
   */
  export namespace authentication {
    /**
     * Get an authentication session matching the desired scopes. Rejects if a provider with providerId is not
     * registered, or if the user does not consent to sharing authentication information with
     * the extension. If there are multiple sessions with the same scopes, the user will be shown a
     * quickpick to select which account they would like to use.
     *
     * Currently, there are only two authentication providers that are contributed from built in extensions
     * to VS Code that implement GitHub and Microsoft authentication: their providerId's are 'github' and 'microsoft'.
     * @param providerId The id of the provider to use
     * @param scopes A list of scopes representing the permissions requested. These are dependent on the authentication provider
     * @param options The {@link GetSessionOptions} to use
     * @returns A thenable that resolves to an authentication session
     */
    export function getSession(providerId: string, scopes: string[], options: AuthenticationGetSessionOptions & { createIfNone: true }): Thenable<AuthenticationSession>;

    /**
     * Get an authentication session matching the desired scopes. Rejects if a provider with providerId is not
     * registered, or if the user does not consent to sharing authentication information with
     * the extension. If there are multiple sessions with the same scopes, the user will be shown a
     * quickpick to select which account they would like to use.
     *
     * Currently, there are only two authentication providers that are contributed from built in extensions
     * to VS Code that implement GitHub and Microsoft authentication: their providerId's are 'github' and 'microsoft'.
     * @param providerId The id of the provider to use
     * @param scopes A list of scopes representing the permissions requested. These are dependent on the authentication provider
     * @param options The {@link GetSessionOptions} to use
     * @returns A thenable that resolves to an authentication session if available, or undefined if there are no sessions
     */
    export function getSession(providerId: string, scopes: string[], options?: AuthenticationGetSessionOptions): Thenable<AuthenticationSession | undefined>;

    /**
     * An {@link Event} which fires when the authentication sessions of an authentication provider have
     * been added, removed, or changed.
     */
    export const onDidChangeSessions: Event<AuthenticationSessionsChangeEvent>;

    /**
     * Register an authentication provider.
     *
     * There can only be one provider per id and an error is being thrown when an id
     * has already been used by another provider. Ids are case-sensitive.
     *
     * @param id The unique identifier of the provider.
     * @param label The human-readable name of the provider.
     * @param provider The authentication provider provider.
     * @params options Additional options for the provider.
     * @return A {@link Disposable} that unregisters this provider when being disposed.
     */
    export function registerAuthenticationProvider(id: string, label: string, provider: AuthenticationProvider, options?: AuthenticationProviderOptions): Disposable;
  }
}
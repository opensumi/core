declare module 'vscode' {
  // https://github.com/microsoft/vscode/issues/88309
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
}

import { AuthenticationSessionsChangeEvent, AuthenticationSession, AuthenticationProviderInformation } from '@ali/ide-core-common';

export interface IMainThreadAuthentication {
  $registerAuthenticationProvider(id: string, label: string, supportsMultipleAccounts: boolean): void;
  $unregisterAuthenticationProvider(id: string): void;
  $ensureProvider(id: string): Promise<void>;
  $getProviderIds(): Promise<string[]>;
  $sendDidChangeSessions(providerId: string, event: AuthenticationSessionsChangeEvent): void;
  $getSession(providerId: string, scopes: string[], extensionId: string, extensionName: string, options: { createIfNone?: boolean, clearSessionPreference?: boolean }): Promise<AuthenticationSession | undefined>;
  $selectSession(providerId: string, providerName: string, extensionId: string, extensionName: string, potentialSessions: AuthenticationSession[], scopes: string[], clearSessionPreference: boolean): Promise<AuthenticationSession>;
  $getSessionsPrompt(providerId: string, accountName: string, providerName: string, extensionId: string, extensionName: string): Promise<boolean>;
  $loginPrompt(providerName: string, extensionName: string): Promise<boolean>;
  $setTrustedExtensionAndAccountPreference(providerId: string, accountName: string, extensionId: string, extensionName: string, sessionId: string): Promise<void>;
  $requestNewSession(providerId: string, scopes: string[], extensionId: string, extensionName: string): Promise<void>;

  $getSessions(providerId: string): Promise<ReadonlyArray<AuthenticationSession>>;
  $login(providerId: string, scopes: string[]): Promise<AuthenticationSession>;
  $logout(providerId: string, sessionId: string): Promise<void>;

}

export interface IExtHostAuthentication {
  $getSessions(id: string): Promise<ReadonlyArray<AuthenticationSession>>;
  $getSessionAccessToken(id: string, sessionId: string): Promise<string>;
  $login(id: string, scopes: string[]): Promise<AuthenticationSession>;
  $logout(id: string, sessionId: string): Promise<void>;
  $onDidChangeAuthenticationSessions(id: string, label: string, event: AuthenticationSessionsChangeEvent): Promise<void>;
  $onDidChangeAuthenticationProviders(added: AuthenticationProviderInformation[], removed: AuthenticationProviderInformation[]): Promise<void>;
  $setProviders(providers: AuthenticationProviderInformation[]): Promise<void>;
}

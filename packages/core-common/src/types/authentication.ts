import { IDisposable } from '../disposable';
import { Event } from '../event';

export const noAccountsId = 'authentication.noAccounts';

export const ACCOUNTS_MENU = ['accounts_menu'];
export const ACCOUNTS_SUBMENU = [...ACCOUNTS_MENU, '1_accounts_submenu'];

export interface AllowedExtension {
  id: string;
  name: string;
}

export interface AuthenticationSessionsChangeEvent {
  added: ReadonlyArray<AuthenticationSession>;
  removed: ReadonlyArray<AuthenticationSession>;
  changed: ReadonlyArray<AuthenticationSession>;
}

export interface AuthenticationSession {
  id: string;
  accessToken: string;
  account: {
    label: string;
    id: string;
  };
  scopes: ReadonlyArray<string>;
}

export interface AuthenticationProviderInformation {
  id: string;
  label: string;
}

export interface AllowedExtension {
  id: string;
  name: string;
}

export interface IAuthenticationProvider {
  id: string;
  label: string;
  supportsMultipleAccounts: boolean;
  manageTrustedExtensions(accountName: string): Promise<void>;
  updateSessionItems(event: AuthenticationSessionsChangeEvent): Promise<void>;
  getSessions(): Promise<ReadonlyArray<AuthenticationSession>>;
  hasSessions(): boolean;
  login(scopes: string[]): Promise<AuthenticationSession>;
  logout(sessionId: string): Promise<void>;
  signOut(accountName: string): Promise<void>;
  dispose(): void;
}

export const IAuthenticationService = Symbol('IAuthenticationService');
export interface IAuthenticationService {
  readonly onDidRegisterAuthenticationProvider: Event<AuthenticationProviderInformation>;
  readonly onDidUnregisterAuthenticationProvider: Event<AuthenticationProviderInformation>;
  readonly onDidChangeSessions: Event<{ providerId: string; label: string; event: AuthenticationSessionsChangeEvent }>;
  initialize(): Promise<void>;
  isAuthenticationProviderRegistered(id: string): boolean;
  getProviderIds(): string[];
  registerAuthenticationProvider(id: string, provider: IAuthenticationProvider): void;
  unregisterAuthenticationProvider(id: string): void;
  requestNewSession(providerId: string, scopes: string[], extensionId: string, extensionName: string): Promise<void>;
  sessionsUpdate(providerId: string, event: AuthenticationSessionsChangeEvent): void;

  getSessions(
    id: string,
    scopes?: string[],
    activateImmediate?: boolean,
  ): Promise<ReadonlyArray<AuthenticationSession>>;
  getLabel(providerId: string): string;
  supportsMultipleAccounts(providerId: string): boolean;
  login(providerId: string, scopes: string[]): Promise<AuthenticationSession>;
  logout(providerId: string, sessionId: string): Promise<void>;

  manageTrustedExtensionsForAccount(providerId: string, accountName: string): Promise<void>;
  signOutOfAccount(providerId: string, accountName: string): Promise<void>;

  getExtensionSessionId(extensionName: string, providerId: string): Promise<string | undefined>;
  setExtensionSessionId(extensionName: string, providerId: string, sessionId: string): Promise<void>;
  removeExtensionSessionId(extensionName: string, providerId: string): Promise<void>;

  getAllowedExtensions(providerId: string, accountName: string): Promise<AllowedExtension[]>;
  setAllowedExtensions(providerId: string, accountName: string, allowList: AllowedExtension[]): Promise<void>;
  removeAllowedExtensions(providerId: any, accountName: string): Promise<void>;

  getAccountUsages(providerId: string, accountName: string): Promise<IAccountUsage[]>;
  addAccountUsage(providerId: string, accountName: string, extensionId: string, extensionName: string): Promise<void>;
  removeAccountUsage(providerId: string, accountName: string): Promise<void>;
}

export interface IAccountUsage {
  extensionId: string;
  extensionName: string;
  lastUsed: number;
}

export interface SessionRequest {
  disposables: IDisposable[];
  requestingExtensionIds: string[];
}

export interface SessionRequestInfo {
  [scopes: string]: SessionRequest;
}

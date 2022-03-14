import { Autowired, Injectable } from '@opensumi/di';
import {
  AllowedExtension,
  IAuthenticationService,
  IAuthenticationProvider,
  AuthenticationSessionsChangeEvent,
  AuthenticationSession,
  IAccountUsage,
  StorageProvider,
  IStorage,
  URI,
  STORAGE_SCHEMA,
  ILogger,
  IEventBus,
  ExtensionActivateEvent,
  Event,
  Emitter,
  AuthenticationProviderInformation,
  Disposable,
  SessionRequestInfo,
  formatLocalize,
  CommandRegistry,
  IDisposable,
  noAccountsId,
  DisposableCollection,
} from '@opensumi/ide-core-common';

import { IMenuRegistry, MenuId } from '../menu/next';

@Injectable()
export class AuthenticationService extends Disposable implements IAuthenticationService {
  @Autowired(ILogger)
  protected readonly logger: ILogger;

  @Autowired(StorageProvider)
  protected readonly getStorage: StorageProvider;

  @Autowired(IEventBus)
  protected readonly eventBus: IEventBus;

  @Autowired(IMenuRegistry)
  protected readonly menus: IMenuRegistry;

  @Autowired(CommandRegistry)
  protected readonly commands: CommandRegistry;

  private _onDidRegisterAuthenticationProvider: Emitter<AuthenticationProviderInformation> = this.registerDispose(
    new Emitter<AuthenticationProviderInformation>(),
  );
  public readonly onDidRegisterAuthenticationProvider: Event<AuthenticationProviderInformation> =
    this._onDidRegisterAuthenticationProvider.event;

  private _onDidUnregisterAuthenticationProvider: Emitter<AuthenticationProviderInformation> = this.registerDispose(
    new Emitter<AuthenticationProviderInformation>(),
  );
  readonly onDidUnregisterAuthenticationProvider: Event<AuthenticationProviderInformation> =
    this._onDidUnregisterAuthenticationProvider.event;

  private _onDidChangeSessions: Emitter<{
    providerId: string;
    label: string;
    event: AuthenticationSessionsChangeEvent;
  }> = this.registerDispose(
    new Emitter<{ providerId: string; label: string; event: AuthenticationSessionsChangeEvent }>(),
  );
  readonly onDidChangeSessions: Event<{ providerId: string; label: string; event: AuthenticationSessionsChangeEvent }> =
    this._onDidChangeSessions.event;

  private _storage: IStorage;

  private _authenticationProviders: Map<string, IAuthenticationProvider> = new Map<string, IAuthenticationProvider>();

  private _signInRequestItems = new Map<string, SessionRequestInfo>();

  private _noAccountsMenuItem: IDisposable | undefined;

  async initialize() {
    this._storage = await this.getStorage(new URI('authentication').withScheme(STORAGE_SCHEMA.GLOBAL));
    const disposableMap = new Map<string, DisposableCollection>();
    this.onDidChangeSessions(async (e) => {
      if (e.event.added.length > 0) {
        const sessions = await this.getSessions(e.providerId);
        sessions.forEach((session) => {
          if (sessions.find((s) => disposableMap.get(s.id))) {
            return;
          }
          const disposables = new DisposableCollection();
          const signOutCommandId = `account-sign-out-${e.providerId}-${session.id}`;
          const signOutCommand = this.commands.registerCommand(
            {
              id: signOutCommandId,
              label: formatLocalize('authentication.signOut', e.label),
            },
            {
              execute: async () => {
                await this.signOutOfAccount(e.providerId, session.account.label);
              },
            },
          );
          const manageTrustedCommandId = `manage-trusted-${e.providerId}-${session.id}`;
          const manageTrustedCommand = this.commands.registerCommand(
            {
              id: manageTrustedCommandId,
              label: '%authentication.manageTrustedExtensions%',
            },
            {
              execute: async () => {
                await this.manageTrustedExtensionsForAccount(e.providerId, session.account.label);
              },
            },
          );

          const accountMenuId = `${e.providerId}${session.account.label}`;
          const accountMenu = this.menus.registerMenuItem(MenuId.AccountsContext, {
            submenu: accountMenuId,
            label: `${session.account.label} (${e.label})`,
          });
          const menuAction = this.menus.registerMenuItems(accountMenuId, [
            {
              command: manageTrustedCommandId,
            },
            {
              command: signOutCommandId,
            },
          ]);
          disposables.push(accountMenu);
          disposables.push(menuAction);
          disposables.push(signOutCommand);
          disposables.push(manageTrustedCommand);
          disposableMap.set(session.id, disposables);
        });
      }
      if (e.event.removed.length > 0) {
        e.event.removed.forEach((removed) => {
          const toDispose = disposableMap.get(removed.id);
          if (toDispose) {
            toDispose.dispose();
            disposableMap.delete(removed.id);
          }
        });
      }
    });
  }

  get storage() {
    return this._storage;
  }

  registerAuthenticationProvider(id: string, provider: IAuthenticationProvider) {
    this._authenticationProviders.set(id, provider);
    this._onDidRegisterAuthenticationProvider.fire({ id, label: provider.label });

    this.updateAccountsMenuItem();
  }

  async sessionsUpdate(providerId: string, event: AuthenticationSessionsChangeEvent) {
    const provider = this._authenticationProviders.get(providerId);
    if (provider) {
      this._onDidChangeSessions.fire({ providerId, label: provider.label, event });
      await provider.updateSessionItems(event);
      this.updateAccountsMenuItem();

      if (event.added) {
        await this.updateNewSessionRequests(provider);
      }
    }
  }

  private async updateNewSessionRequests(provider: IAuthenticationProvider): Promise<void> {
    const existingRequestsForProvider = this._signInRequestItems.get(provider.id);
    if (!existingRequestsForProvider) {
      return;
    }

    const sessions = await provider.getSessions();
    Object.keys(existingRequestsForProvider).forEach((requestedScopes) => {
      if (sessions.some((session) => session.scopes.slice().sort().join('') === requestedScopes)) {
        const sessionRequest = existingRequestsForProvider[requestedScopes];
        if (sessionRequest) {
          sessionRequest.disposables.forEach((item) => item.dispose());
        }

        delete existingRequestsForProvider[requestedScopes];
        if (Object.keys(existingRequestsForProvider).length === 0) {
          this._signInRequestItems.delete(provider.id);
        } else {
          this._signInRequestItems.set(provider.id, existingRequestsForProvider);
        }
      }
    });
  }

  private getTrustedKey(providerId: string, accountName: string) {
    return `trusted-${providerId}-${accountName}`;
  }

  async getAllowedExtensions(providerId: string, accountName: string) {
    const storageKey = this.getTrustedKey(providerId, accountName);
    let trustedExtensions: AllowedExtension[] = [];
    try {
      const trustedExtensionSrc = await this.storage.get<string>(storageKey);
      if (trustedExtensionSrc) {
        trustedExtensions = JSON.parse(trustedExtensionSrc);
      }
    } catch (err) {
      this.logger.warn('read allow extensions error: ' + err);
    }

    return trustedExtensions;
  }

  async setAllowedExtensions(providerId: string, accountName: string, allowList: AllowedExtension[]) {
    const storageKey = this.getTrustedKey(providerId, accountName);
    await this.storage.set(storageKey, JSON.stringify(allowList));
  }

  async removeAllowedExtensions(providerId: string, accountName: string) {
    const storageKey = this.getTrustedKey(providerId, accountName);
    await this.storage.delete(storageKey);
  }

  private async tryActivateProvider(providerId: string): Promise<IAuthenticationProvider> {
    await this.eventBus.fireAndAwait(new ExtensionActivateEvent({ topic: 'onView', data: providerId }));
    let provider = this._authenticationProviders.get(providerId);
    if (provider) {
      return provider;
    }

    // When activate has completed, the extension has made the call to `registerAuthenticationProvider`.
    // However, activate cannot block on this, so the renderer may not have gotten the event yet.
    const didRegister: Promise<IAuthenticationProvider> = new Promise((resolve, _) => {
      this.onDidRegisterAuthenticationProvider((e) => {
        if (e.id === providerId) {
          provider = this._authenticationProviders.get(providerId);
          if (provider) {
            resolve(provider);
          } else {
            throw new Error(`No authentication provider '${providerId}' is currently registered.`);
          }
        }
      });
    });

    const didTimeout: Promise<IAuthenticationProvider> = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`didRegister ${providerId} timeout`));
      }, 5000);
    });

    return Promise.race([didRegister, didTimeout]);
  }

  async getSessions(providerId: string): Promise<ReadonlyArray<AuthenticationSession>> {
    try {
      const authProvider =
        this._authenticationProviders.get(providerId) || (await this.tryActivateProvider(providerId));
      return await authProvider.getSessions();
    } catch (_) {
      throw new Error(`No authentication provider '${providerId}' is currently registered.`);
    }
  }

  isAuthenticationProviderRegistered(id: string): boolean {
    return this._authenticationProviders.has(id);
  }
  getProviderIds(): string[] {
    const providerIds: string[] = [];
    this._authenticationProviders.forEach((provider) => {
      providerIds.push(provider.id);
    });
    return providerIds;
  }
  unregisterAuthenticationProvider(id: string): void {
    const provider = this._authenticationProviders.get(id);
    if (provider) {
      provider.dispose();
      this._authenticationProviders.delete(id);
      this._onDidUnregisterAuthenticationProvider.fire({ id, label: provider.label });
      this.updateAccountsMenuItem();
    }
  }

  private updateAccountsMenuItem(): void {
    let hasSession = false;
    this._authenticationProviders.forEach((provider) => {
      hasSession = hasSession || provider.hasSessions();
    });

    if (hasSession && this._noAccountsMenuItem) {
      this._noAccountsMenuItem.dispose();
      this._noAccountsMenuItem = undefined;
    }

    if (!hasSession && !this._noAccountsMenuItem) {
      this._noAccountsMenuItem = this.menus.registerMenuItem(MenuId.AccountsContext, {
        group: '0_accounts',
        command: noAccountsId,
      });
    }
  }

  async requestNewSession(providerId: string, scopes: string[], extensionId: string, extensionName: string) {
    let provider = this._authenticationProviders.get(providerId);
    if (!provider) {
      // Activate has already been called for the authentication provider, but it cannot block on registering itself
      // since this is sync and returns a disposable. So, wait for registration event to fire that indicates the
      // provider is now in the map.
      await new Promise<void>((resolve, _) => {
        this.onDidRegisterAuthenticationProvider((e) => {
          if (e.id === providerId) {
            provider = this._authenticationProviders.get(providerId);
            resolve();
          }
        });
      });
    }

    if (provider) {
      const providerRequests = this._signInRequestItems.get(providerId);
      const scopesList = scopes.sort().join('');
      const extensionHasExistingRequest =
        providerRequests &&
        providerRequests[scopesList] &&
        providerRequests[scopesList].requestingExtensionIds.includes(extensionId);

      if (extensionHasExistingRequest) {
        return;
      }

      const signInCommand = this.commands.registerCommand(
        {
          id: `${extensionId}signIn`,
          label: formatLocalize('authentication.signInRequests', extensionName),
        },
        {
          execute: async () => {
            const session = await this.login(providerId, scopes);
            const accountName = session.account.label;
            // Add extension to allow list since user explicitly signed in on behalf of it
            const allowList = await this.getAllowedExtensions(providerId, accountName);
            if (!allowList.find((allowed) => allowed.id === extensionId)) {
              allowList.push({ id: extensionId, name: extensionName });
              await this.setAllowedExtensions(providerId, accountName, allowList);
            }

            // And also set it as the preferred account for the extension
            await this.setExtensionSessionId(extensionName, providerId, session.id);
          },
        },
      );

      const menuItem = this.menus.registerMenuItem(MenuId.AccountsContext, {
        group: '2_signInRequests',
        command: `${extensionId}signIn`,
      });

      if (providerRequests) {
        const existingRequest = providerRequests[scopesList] || { disposables: [], requestingExtensionIds: [] };

        providerRequests[scopesList] = {
          disposables: [...existingRequest.disposables, menuItem, signInCommand],
          requestingExtensionIds: [...existingRequest.requestingExtensionIds, extensionId],
        };
        this._signInRequestItems.set(providerId, providerRequests);
      } else {
        this._signInRequestItems.set(providerId, {
          [scopesList]: {
            disposables: [menuItem, signInCommand],
            requestingExtensionIds: [extensionId],
          },
        });
      }
    }
  }
  getLabel(providerId: string): string {
    const authProvider = this._authenticationProviders.get(providerId);
    if (authProvider) {
      return authProvider.label;
    } else {
      throw new Error(`No authentication provider '${providerId}' has been declared.`);
    }
  }
  supportsMultipleAccounts(providerId: string): boolean {
    const authProvider = this._authenticationProviders.get(providerId);
    if (authProvider) {
      return authProvider.supportsMultipleAccounts;
    } else {
      throw new Error(`No authentication provider '${providerId}' is currently registered.`);
    }
  }
  async login(providerId: string, scopes: string[]): Promise<AuthenticationSession> {
    try {
      const authProvider =
        this._authenticationProviders.get(providerId) || (await this.tryActivateProvider(providerId));
      return await authProvider.login(scopes);
    } catch (_) {
      throw new Error(`No authentication provider '${providerId}' is currently registered.`);
    }
  }
  logout(providerId: string, sessionId: string): Promise<void> {
    const authProvider = this._authenticationProviders.get(providerId);
    if (authProvider) {
      return authProvider.logout(sessionId);
    } else {
      throw new Error(`No authentication provider '${providerId}' is currently registered.`);
    }
  }
  manageTrustedExtensionsForAccount(providerId: string, accountName: string): Promise<void> {
    const authProvider = this._authenticationProviders.get(providerId);
    if (authProvider) {
      return authProvider.manageTrustedExtensions(accountName);
    } else {
      throw new Error(`No authentication provider '${providerId}' is currently registered.`);
    }
  }
  signOutOfAccount(providerId: string, accountName: string): Promise<void> {
    const authProvider = this._authenticationProviders.get(providerId);
    if (authProvider) {
      return authProvider.signOut(accountName);
    } else {
      throw new Error(`No authentication provider '${providerId}' is currently registered.`);
    }
  }

  private getUsagesKey(providerId: string, accountName: string) {
    return `usages-${providerId}-${accountName}`;
  }

  async getAccountUsages(providerId: string, accountName: string) {
    const accountKey = this.getUsagesKey(providerId, accountName);
    const storedUsages = await this.storage.get<string>(accountKey);
    let usages: IAccountUsage[] = [];
    if (storedUsages) {
      try {
        usages = JSON.parse(storedUsages);
      } catch (err) {
        this.logger.warn('parse account usages error: ' + err);
      }
    }

    return usages;
  }

  async addAccountUsage(providerId: string, accountName: string, extensionId: string, extensionName: string) {
    const accountKey = this.getUsagesKey(providerId, accountName);
    const usages = await this.getAccountUsages(providerId, accountName);

    const existingUsageIndex = usages.findIndex((usage) => usage.extensionId === extensionId);
    if (existingUsageIndex > -1) {
      usages.splice(existingUsageIndex, 1, {
        extensionId,
        extensionName,
        lastUsed: Date.now(),
      });
    } else {
      usages.push({
        extensionId,
        extensionName,
        lastUsed: Date.now(),
      });
    }

    await this.storage.set(accountKey, JSON.stringify(usages));
  }

  async removeAccountUsage(providerId: string, accountName: string) {
    const accountKey = this.getUsagesKey(providerId, accountName);
    await this.storage.delete(accountKey);
  }

  private getExtensionSessionIdKey(providerId: string, accountName: string) {
    return `session-${providerId}-${accountName}`;
  }

  async getExtensionSessionId(extensionName: string, providerId: string): Promise<string | undefined> {
    const accountKey = this.getExtensionSessionIdKey(extensionName, providerId);
    return await this.storage.get(accountKey);
  }
  async setExtensionSessionId(extensionName: string, providerId: string, sessionId: string): Promise<void> {
    const accountKey = this.getExtensionSessionIdKey(extensionName, providerId);
    await this.storage.set(accountKey, sessionId);
  }
  async removeExtensionSessionId(extensionName: string, providerId: string): Promise<void> {
    const accountKey = this.getExtensionSessionIdKey(extensionName, providerId);
    await this.storage.delete(accountKey);
  }
}

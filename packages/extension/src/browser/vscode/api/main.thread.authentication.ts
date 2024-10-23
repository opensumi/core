import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection';
import { Disposable, ILogger, QuickPickService, formatLocalize, localize } from '@opensumi/ide-core-browser';
import {
  AuthenticationSession,
  AuthenticationSessionsChangeEvent,
  IAuthenticationProvider,
  IAuthenticationService,
} from '@opensumi/ide-core-common';
import { IDialogService, IMessageService } from '@opensumi/ide-overlay';

import { ExtHostAPIIdentifier, IExtHostAuthentication, IMainThreadAuthentication } from '../../../common/vscode';
import { IActivationEventService } from '../../types';

import type vscode from 'vscode';

@Injectable({ multiple: true })
export class MainThreadAuthenticationProvider extends Disposable implements IAuthenticationProvider {
  @Autowired(IAuthenticationService)
  protected readonly authenticationService: IAuthenticationService;

  @Autowired(QuickPickService)
  protected readonly quickPickService: QuickPickService;

  @Autowired(IDialogService)
  protected readonly dialogService: IDialogService;

  @Autowired(IMessageService)
  protected readonly messageService: IMessageService;

  @Autowired(ILogger)
  protected readonly logger: ILogger;

  private _accounts = new Map<string, string[]>(); // Map account name to session ids
  private _sessions = new Map<string, string>(); // Map account id to name

  constructor(
    private readonly _proxy: IExtHostAuthentication,
    public readonly id: string,
    public readonly label: string,
    public readonly supportsMultipleAccounts: boolean,
  ) {
    super();
  }

  public async initialize(): Promise<void> {
    return this.registerCommandsAndContextMenuItems();
  }

  public async manageTrustedExtensions(accountName: string) {
    const allowedExtensions = await this.authenticationService.getAllowedExtensions(this.id, accountName);

    if (!allowedExtensions.length) {
      this.dialogService.info(localize('authentication.noTrustedExtensions'));
      return;
    }

    const usages = await this.authenticationService.getAccountUsages(this.id, accountName);
    const items = allowedExtensions.map((extension) => {
      const usage = usages.find((usage) => extension.id === usage.extensionId);
      return {
        label: extension.name,
        description: usage ? localize('authentication.accountLastUsedDate') : localize('authentication.notUsed'),
        value: extension,
      };
    });

    const trustedExtension = await this.quickPickService.show(items, {
      title: localize('authentication.manageTrustedExtensions'),
      placeholder: localize('authentication.manageExtensions'),
    });

    if (trustedExtension) {
      await this.authenticationService.setAllowedExtensions(this.id, accountName, [trustedExtension]);
    }
  }

  async signOut(accountName: string): Promise<void> {
    const accountUsages = await this.authenticationService.getAccountUsages(this.id, accountName);
    const sessionsForAccount = this._accounts.get(accountName);
    const message = accountUsages.length
      ? formatLocalize(
          'authentication.signOutMessage',
          accountName,
          accountUsages.map((usage) => usage.extensionName).join('\n'),
        )
      : formatLocalize('authentication.signOutMessageSimple', accountName);
    const result = await this.dialogService.info(message, [localize('ButtonCancel'), localize('ButtonOK')]);

    if (result === localize('ButtonOK')) {
      sessionsForAccount?.forEach((sessionId) => this.logout(sessionId));
      await this.authenticationService.removeAccountUsage(this.id, accountName);
      await this.authenticationService.removeAllowedExtensions(this.id, accountName);
    }
  }

  async getSessions(): Promise<ReadonlyArray<AuthenticationSession>> {
    return this._proxy.$getSessions(this.id);
  }

  public hasSessions(): boolean {
    return !!this._sessions.size;
  }

  async updateSessionItems(event: AuthenticationSessionsChangeEvent): Promise<void> {
    const { added, removed } = event;
    const session = await this._proxy.$getSessions(this.id);
    const addedSessions = session.filter((session) => added.some((s) => s.id === session.id));

    removed.forEach((session) => {
      const accountName = this._sessions.get(session.id);
      if (accountName) {
        this._sessions.delete(session.id);
        const sessionsForAccount = this._accounts.get(accountName) || [];
        const sessionIndex = sessionsForAccount.indexOf(session.id);
        sessionsForAccount.splice(sessionIndex);

        if (!sessionsForAccount.length) {
          this._accounts.delete(accountName);
        }
      }
    });

    addedSessions.forEach((session) => this.registerSession(session));
  }

  private async registerCommandsAndContextMenuItems(): Promise<void> {
    try {
      const sessions = await this._proxy.$getSessions(this.id);
      sessions.forEach((session) => this.registerSession(session));
    } catch (err) {
      this.logger.error(err);
    }
  }

  private registerSession(session: AuthenticationSession) {
    this._sessions.set(session.id, session.account.label);

    const existingSessionsForAccount = this._accounts.get(session.account.label);
    if (existingSessionsForAccount) {
      this._accounts.set(session.account.label, existingSessionsForAccount.concat(session.id));
      return;
    } else {
      this._accounts.set(session.account.label, [session.id]);
    }
  }

  login(scopes: string[]): Promise<AuthenticationSession> {
    return this._proxy.$login(this.id, scopes);
  }

  async logout(sessionId: string): Promise<void> {
    await this._proxy.$logout(this.id, sessionId);
    this.messageService.info(localize('authentication.signedOut'));
  }
}

@Injectable({ multiple: true })
export class MainThreadAuthentication extends Disposable implements IMainThreadAuthentication {
  private readonly _proxy: IExtHostAuthentication;

  @Autowired(INJECTOR_TOKEN)
  protected readonly injector: Injector;

  @Autowired(IAuthenticationService)
  protected readonly authenticationService: IAuthenticationService;

  @Autowired(IDialogService)
  protected readonly dialogService: IDialogService;

  @Autowired(IMessageService)
  protected readonly messageService: IMessageService;

  @Autowired(QuickPickService)
  protected readonly quickPickService: QuickPickService;

  @Autowired(IActivationEventService)
  protected readonly activationService: IActivationEventService;

  constructor(protocol: IRPCProtocol) {
    super();
    this._proxy = protocol.getProxy(ExtHostAPIIdentifier.ExtHostAuthentication);

    this.addDispose(
      this.authenticationService.onDidChangeSessions((e) => {
        this._proxy.$onDidChangeAuthenticationSessions(e.providerId, e.label, e.event);
      }),
    );

    this.addDispose(
      this.authenticationService.onDidRegisterAuthenticationProvider((info) => {
        this._proxy.$onDidChangeAuthenticationProviders([info], []);
      }),
    );

    this.addDispose(
      this.authenticationService.onDidUnregisterAuthenticationProvider((info) => {
        this._proxy.$onDidChangeAuthenticationProviders([], [info]);
      }),
    );
  }
  $getProviderIds(): Promise<string[]> {
    return Promise.resolve(this.authenticationService.getProviderIds());
  }

  async $registerAuthenticationProvider(id: string, label: string, supportsMultipleAccounts: boolean): Promise<void> {
    const provider = this.injector.get(MainThreadAuthenticationProvider, [
      this._proxy,
      id,
      label,
      supportsMultipleAccounts,
    ]);
    await provider.initialize();
    this.authenticationService.registerAuthenticationProvider(id, provider);

    this.addDispose(
      Disposable.create(() => {
        this.$unregisterAuthenticationProvider(id);
      }),
    );
  }

  $unregisterAuthenticationProvider(id: string): void {
    this.authenticationService.unregisterAuthenticationProvider(id);
  }

  $ensureProvider(id: string): Promise<void> {
    return this.activationService.fireEvent('onAuthenticationRequest', id);
  }

  $sendDidChangeSessions(id: string, event: AuthenticationSessionsChangeEvent): void {
    this.authenticationService.sessionsUpdate(id, event);
  }

  $getSessions(id: string): Promise<ReadonlyArray<AuthenticationSession>> {
    return this.authenticationService.getSessions(id);
  }

  $login(providerId: string, scopes: string[]): Promise<AuthenticationSession> {
    return this.authenticationService.login(providerId, scopes);
  }

  $logout(providerId: string, sessionId: string): Promise<void> {
    return this.authenticationService.logout(providerId, sessionId);
  }

  private async doGetSession(
    providerId: string,
    scopes: string[],
    extensionId: string,
    extensionName: string,
    options: vscode.AuthenticationGetSessionOptions,
  ): Promise<AuthenticationSession | undefined> {
    const sessions = await this.authenticationService.getSessions(providerId, scopes, true);
    const supportsMultipleAccounts = this.authenticationService.supportsMultipleAccounts(providerId);

    // Error cases
    if (options.forceNewSession && !sessions.length) {
      throw new Error('No existing sessions found.');
    }
    if (options.forceNewSession && options.createIfNone) {
      throw new Error(
        'Invalid combination of options. Please remove one of the following: forceNewSession, createIfNone',
      );
    }
    if (options.forceNewSession && options.silent) {
      throw new Error('Invalid combination of options. Please remove one of the following: forceNewSession, silent');
    }
    if (options.createIfNone && options.silent) {
      throw new Error('Invalid combination of options. Please remove one of the following: createIfNone, silent');
    }
    // Check if the sessions we have are valid
    if (!options.forceNewSession && sessions.length) {
      if (supportsMultipleAccounts) {
        if (options.clearSessionPreference) {
          await this.authenticationService.removeExtensionSessionId(extensionName, providerId);
        } else {
          const existingSessionPreference = await this.authenticationService.getExtensionSessionId(
            extensionName,
            providerId,
          );
          if (existingSessionPreference) {
            const matchingSession = sessions.find((session) => session.id === existingSessionPreference);
            if (
              matchingSession &&
              (await this.authenticationService.isAccessAllowed(providerId, matchingSession.account.label, extensionId))
            ) {
              return matchingSession;
            }
          }
        }
      } else if (await this.authenticationService.isAccessAllowed(providerId, sessions[0].account.label, extensionId)) {
        return sessions[0];
      }
    }
    // We may need to prompt because we don't have a valid session
    // modal flows
    if (options.createIfNone || options.forceNewSession) {
      const providerName = this.authenticationService.getLabel(providerId);
      const detail = typeof options.forceNewSession === 'object' ? options.forceNewSession!.detail : undefined;
      const isAllowed = await this.loginPrompt(providerName, extensionName, !!options.forceNewSession, detail);
      if (!isAllowed) {
        throw new Error('User did not consent to login.');
      }
      const session =
        sessions?.length && !options.forceNewSession && supportsMultipleAccounts
          ? await this.selectSession(
              providerId,
              providerName,
              extensionId,
              extensionName,
              sessions,
              scopes,
              !!options.clearSessionPreference,
            )
          : await this.authenticationService.login(providerId, scopes);
      await this.authenticationService.updatedAllowedExtension(
        providerId,
        session.account.label,
        extensionId,
        extensionName,
        true,
      );
      await this.authenticationService.setExtensionSessionId(extensionName, providerId, session.id);
      return session;
    }

    // passive flows (silent or default)
    const validSession = sessions.find((s) =>
      this.authenticationService.isAccessAllowed(providerId, s.account.label, extensionId),
    );

    if (!options.silent && !validSession) {
      await this.authenticationService.requestNewSession(providerId, scopes, extensionId, extensionName);
    }
    return validSession;
  }

  async $getSession(
    providerId: string,
    scopes: string[],
    extensionId: string,
    extensionName: string,
    options: { createIfNone: boolean; clearSessionPreference: boolean },
  ): Promise<AuthenticationSession | undefined> {
    const session = await this.doGetSession(providerId, scopes, extensionId, extensionName, options);

    if (session) {
      await this.authenticationService.addAccountUsage(providerId, session.account.label, extensionId, extensionName);
    }

    return session;
  }

  async selectSession(
    providerId: string,
    providerName: string,
    extensionId: string,
    extensionName: string,
    potentialSessions: readonly AuthenticationSession[],
    scopes: string[],
    clearSessionPreference: boolean,
  ): Promise<AuthenticationSession> {
    if (!potentialSessions.length) {
      throw new Error('No potential sessions found');
    }

    if (clearSessionPreference) {
      await this.authenticationService.removeExtensionSessionId(extensionName, providerId);
    } else {
      const existingSessionPreference = await this.authenticationService.getExtensionSessionId(
        extensionName,
        providerId,
      );
      if (existingSessionPreference) {
        const matchingSession = potentialSessions.find((session) => session.id === existingSessionPreference);
        if (matchingSession) {
          const allowed = await this.$getSessionsPrompt(
            providerId,
            matchingSession.account.label,
            providerName,
            extensionId,
            extensionName,
          );
          if (allowed) {
            return matchingSession;
          }
        }
      }
    }
    const items = potentialSessions.map((session) => ({
      label: session.account.label,
      value: session,
    }));
    items.push({
      label: localize('authentication.useOtherAccount'),
      // 如果登录其他账户则放置一个 undefined 的值用来判断
      value: undefined as unknown as AuthenticationSession,
    });
    const selectedSession = await this.quickPickService.show(items, {
      title: formatLocalize('authentication.selectAccount', extensionName, providerName),
      placeholder: formatLocalize('authentication.getSessionPlaceholder', extensionName),
      ignoreFocusOut: true,
    });

    const session = selectedSession ?? (await this.authenticationService.login(providerId, scopes));
    const accountName = session.account.label;

    const allowList = await this.authenticationService.getAllowedExtensions(providerId, accountName);
    if (!allowList.find((allowed) => allowed.id === extensionId)) {
      allowList.push({ id: extensionId, name: extensionName });
      await this.authenticationService.setAllowedExtensions(providerId, accountName, allowList);
    }

    await this.authenticationService.setExtensionSessionId(extensionName, providerId, session.id);

    return session;
  }

  async $getSessionsPrompt(
    providerId: string,
    accountName: string,
    providerName: string,
    extensionId: string,
    extensionName: string,
  ): Promise<boolean> {
    const allowList = await this.authenticationService.getAllowedExtensions(providerId, accountName);
    const extensionData = allowList.find((extension) => extension.id === extensionId);
    if (extensionData) {
      await this.authenticationService.addAccountUsage(providerId, accountName, extensionId, extensionName);
      return true;
    }

    const choice = await this.dialogService.info(
      formatLocalize('authentication.confirmAuthenticationAccess', extensionName, providerName, accountName),
      [localize('ButtonCancel'), localize('ButtonAllow')],
    );

    const allow = choice === localize('ButtonAllow');
    if (allow) {
      this.authenticationService.addAccountUsage(providerId, accountName, extensionId, extensionName);
      allowList.push({ id: extensionId, name: extensionName });
      await this.authenticationService.setAllowedExtensions(providerId, accountName, allowList);
    }

    return allow;
  }

  // TODO: dialog detail 待实现
  async loginPrompt(
    providerName: string,
    extensionName: string,
    recreatingSession: boolean,
    _detail?: string,
  ): Promise<boolean> {
    const choice = await this.dialogService.info(
      recreatingSession
        ? formatLocalize('authentication.confirmReLogin', extensionName, providerName)
        : formatLocalize('authentication.confirmLogin', extensionName, providerName),
      [localize('ButtonCancel'), localize('ButtonAllow')],
    );

    return choice === localize('ButtonAllow');
  }

  async $setTrustedExtensionAndAccountPreference(
    providerId: string,
    accountName: string,
    extensionId: string,
    extensionName: string,
    sessionId: string,
  ): Promise<void> {
    const allowList = await this.authenticationService.getAllowedExtensions(providerId, accountName);
    if (!allowList.find((allowed) => allowed.id === extensionId)) {
      allowList.push({ id: extensionId, name: extensionName });
      await this.authenticationService.setAllowedExtensions(providerId, accountName, allowList);
    }

    await this.authenticationService.setExtensionSessionId(extensionName, providerId, sessionId);
    await this.authenticationService.addAccountUsage(providerId, accountName, extensionId, extensionName);
  }
}

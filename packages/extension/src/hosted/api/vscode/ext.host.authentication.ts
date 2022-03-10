/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type vscode from 'vscode';

import { IRPCProtocol } from '@opensumi/ide-connection';
import {
  Emitter,
  Disposable,
  Event,
  AuthenticationProviderInformation,
  AuthenticationSessionsChangeEvent,
  AuthenticationSession,
  getDebugLogger,
} from '@opensumi/ide-core-common';

import { MainThreadAPIIdentifier, IExtHostAuthentication, IMainThreadAuthentication } from '../../../common/vscode';
import { ExtensionIdentifier, IExtensionDescription } from '../../../common/vscode/extension';

interface GetSessionsRequest {
  scopes: string;
  result: Promise<vscode.AuthenticationSession | undefined>;
}

interface ProviderWithMetadata {
  label: string;
  provider: vscode.AuthenticationProvider;
  options: vscode.AuthenticationProviderOptions;
}

export function createAuthenticationApiFactory(
  extension: IExtensionDescription,
  extHostAuthentication: ExtHostAuthentication,
) {
  const authentication: typeof vscode.authentication = {
    getSession(providerId: string, scopes: string[], options?: vscode.AuthenticationGetSessionOptions) {
      return extHostAuthentication.getSession(extension, providerId, scopes, options);
    },
    get onDidChangeSessions(): Event<vscode.AuthenticationSessionsChangeEvent> {
      return extHostAuthentication.onDidChangeSessions;
    },
    registerAuthenticationProvider(
      id: string,
      label: string,
      provider: vscode.AuthenticationProvider,
      options?: vscode.AuthenticationProviderOptions,
    ): vscode.Disposable {
      return extHostAuthentication.registerAuthenticationProvider(id, label, provider, options);
    },
    get onDidChangeAuthenticationProviders(): Event<vscode.AuthenticationProvidersChangeEvent> {
      return extHostAuthentication.onDidChangeAuthenticationProviders;
    },
    get providers(): ReadonlyArray<vscode.AuthenticationProviderInformation> {
      return extHostAuthentication.providers;
    },
    logout(providerId: string, sessionId: string): Thenable<void> {
      return extHostAuthentication.logout(providerId, sessionId);
    },
  };
  return authentication;
}

// some code copied and modified from https://github.com/microsoft/vscode/blob/main/src/vs/workbench/api/common/extHostAuthentication.ts#L24
export class ExtHostAuthentication implements IExtHostAuthentication {
  protected readonly logger = getDebugLogger();

  private _proxy: IMainThreadAuthentication;
  private _authenticationProviders: Map<string, ProviderWithMetadata> = new Map<string, ProviderWithMetadata>();

  private _providers: vscode.AuthenticationProviderInformation[] = [];

  private _onDidChangeAuthenticationProviders = new Emitter<vscode.AuthenticationProvidersChangeEvent>();
  readonly onDidChangeAuthenticationProviders: Event<vscode.AuthenticationProvidersChangeEvent> =
    this._onDidChangeAuthenticationProviders.event;

  private _onDidChangeSessions = new Emitter<vscode.AuthenticationSessionsChangeEvent>();
  readonly onDidChangeSessions: Event<vscode.AuthenticationSessionsChangeEvent> = this._onDidChangeSessions.event;

  private _inFlightRequests = new Map<string, GetSessionsRequest[]>();

  constructor(mainContext: IRPCProtocol) {
    this._proxy = mainContext.getProxy(MainThreadAPIIdentifier.MainThreadAuthentication);
  }

  $setProviders(providers: vscode.AuthenticationProviderInformation[]): Promise<void> {
    this._providers = providers;
    return Promise.resolve();
  }

  getProviderIds(): Promise<ReadonlyArray<string>> {
    return this._proxy.$getProviderIds();
  }

  get providers(): ReadonlyArray<vscode.AuthenticationProviderInformation> {
    return Object.freeze(this._providers.slice());
  }

  async getSession(
    requestingExtension: IExtensionDescription,
    providerId: string,
    scopes: string[],
    options: vscode.AuthenticationGetSessionOptions = {},
  ): Promise<vscode.AuthenticationSession | undefined> {
    const extensionId = ExtensionIdentifier.toKey(requestingExtension.identifier);
    const inFlightRequests = this._inFlightRequests.get(extensionId) || [];
    const sortedScopes = scopes.sort().join(' ');
    let inFlightRequest: GetSessionsRequest | undefined = inFlightRequests.find(
      (request) => request.scopes === sortedScopes,
    );

    if (inFlightRequest) {
      return inFlightRequest.result;
    } else {
      const session = this._getSession(requestingExtension, extensionId, providerId, scopes, options);
      inFlightRequest = {
        scopes: sortedScopes,
        result: session,
      };

      inFlightRequests.push(inFlightRequest);
      this._inFlightRequests.set(extensionId, inFlightRequests);

      try {
        await session;
      } catch (e) {
        this.logger.error(`get session had a error ${e.message} `);
      } finally {
        const requestIndex = inFlightRequests.findIndex((request) => request.scopes === sortedScopes);
        if (requestIndex > -1) {
          inFlightRequests.splice(requestIndex);
          this._inFlightRequests.set(extensionId, inFlightRequests);
        }
      }

      return session;
    }
  }

  private async _getSession(
    requestingExtension: IExtensionDescription,
    extensionId: string,
    providerId: string,
    scopes: string[],
    options: vscode.AuthenticationGetSessionOptions = {},
  ): Promise<vscode.AuthenticationSession | undefined> {
    await this._proxy.$ensureProvider(providerId);
    const extensionName = requestingExtension.displayName || requestingExtension.name;

    return this._proxy.$getSession(providerId, scopes, extensionId, extensionName, options);
  }

  async logout(providerId: string, sessionId: string): Promise<void> {
    return this._proxy.$logout(providerId, sessionId);
  }

  registerAuthenticationProvider(
    id: string,
    label: string,
    provider: vscode.AuthenticationProvider,
    options?: vscode.AuthenticationProviderOptions,
  ): vscode.Disposable {
    if (this._authenticationProviders.get(id)) {
      throw new Error(`An authentication provider with id '${id}' is already registered.`);
    }

    this._authenticationProviders.set(id, { label, provider, options: options ?? { supportsMultipleAccounts: false } });
    if (!this._providers.find((p) => p.id === id)) {
      this._providers.push({
        id,
        label,
      });
    }

    if (!this._providers.find((p) => p.id === id)) {
      this._providers.push({
        id,
        label,
      });
    }

    const listener = provider.onDidChangeSessions((e) => {
      this._proxy.$sendDidChangeSessions(id, {
        added: e.added ?? [],
        changed: e.changed ?? [],
        removed: e.removed ?? [],
      });
    });

    this._proxy.$registerAuthenticationProvider(id, label, options?.supportsMultipleAccounts ?? false);

    return Disposable.create(() => {
      listener.dispose();
      this._authenticationProviders.delete(id);
      const index = this._providers.findIndex((p) => p.id === id);
      if (index > -1) {
        this._providers.splice(index);
      }

      this._proxy.$unregisterAuthenticationProvider(id);
    });
  }

  $login(providerId: string, scopes: string[]): Promise<AuthenticationSession> {
    const providerData = this._authenticationProviders.get(providerId);
    if (providerData) {
      return Promise.resolve(providerData.provider.createSession(scopes));
    }

    throw new Error(`Unable to find authentication provider with handle: ${providerId}`);
  }

  $logout(providerId: string, sessionId: string): Promise<void> {
    const providerData = this._authenticationProviders.get(providerId);
    if (providerData) {
      return Promise.resolve(providerData.provider.removeSession(sessionId));
    }

    throw new Error(`Unable to find authentication provider with handle: ${providerId}`);
  }

  $getSessions(providerId: string): Promise<ReadonlyArray<AuthenticationSession>> {
    const providerData = this._authenticationProviders.get(providerId);
    if (providerData) {
      return Promise.resolve(providerData.provider.getSessions());
    }

    throw new Error(`Unable to find authentication provider with handle: ${providerId}`);
  }

  async $getSessionAccessToken(providerId: string, sessionId: string): Promise<string> {
    const providerData = this._authenticationProviders.get(providerId);
    if (providerData) {
      const sessions = await providerData.provider.getSessions();
      const session = sessions.find((session) => session.id === sessionId);
      if (session) {
        return session.accessToken;
      }

      throw new Error(`Unable to find session with id: ${sessionId}`);
    }

    throw new Error(`Unable to find authentication provider with handle: ${providerId}`);
  }

  $onDidChangeAuthenticationSessions(id: string, label: string, event: AuthenticationSessionsChangeEvent) {
    this._onDidChangeSessions.fire({ provider: { id, label }, ...event });
    return Promise.resolve();
  }

  $onDidChangeAuthenticationProviders(
    added: AuthenticationProviderInformation[],
    removed: AuthenticationProviderInformation[],
  ) {
    added.forEach((provider) => {
      if (!this._providers.some((p) => p.id === provider.id)) {
        this._providers.push(provider);
      }
    });

    removed.forEach((p) => {
      const index = this._providers.findIndex((provider) => provider.id === p.id);
      if (index > -1) {
        this._providers.splice(index);
      }
    });

    this._onDidChangeAuthenticationProviders.fire({ added, removed });
    return Promise.resolve();
  }
}

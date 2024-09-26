import { ConstructorOf, Injectable, Injector, Optional, Token } from '@opensumi/di';

import { RPCProtocol } from '../types/rpc';

export * from './data-store';

const RemoteServiceInstantiateFlag = Symbol('RemoteServiceInstantiateFlag');
const __remoteServiceInstantiateFlagAllowed = Symbol('RemoteServiceInstantiateFlag_allow');
const __remoteServiceInstantiateFlagDisallowed = Symbol('RemoteServiceInstantiateFlag_disallow');

@Injectable()
export abstract class RemoteService<Client = any> {
  abstract readonly servicePath: string;
  protocol?: RPCProtocol<any>;

  private _clientId: string;
  private _client: Client;
  get rpcClient() {
    return this._client;
  }
  get clientId() {
    return this._clientId;
  }

  protected constructor(@Optional(RemoteServiceInstantiateFlag) flag: symbol) {
    if (flag !== __remoteServiceInstantiateFlagAllowed) {
      throw new Error('Cannot use RemoteService instance directly.');
    }
  }

  init(clientId: string, client: Client) {
    this._clientId = clientId;
    this._client = client;
  }

  static getName(service: Token | ConstructorOf<RemoteService>): string {
    if (typeof service === 'function') {
      return service.name;
    }
    return String(service);
  }
}

export function createRemoteServiceChildInjector(injector: Injector, fn: (childInjector: Injector) => void): Injector {
  const child = injector.createChild([
    {
      token: RemoteServiceInstantiateFlag,
      useValue: __remoteServiceInstantiateFlagAllowed,
    },
  ]);

  fn(child);

  child.overrideProviders({
    token: RemoteServiceInstantiateFlag,
    useValue: __remoteServiceInstantiateFlagDisallowed,
    override: true,
  });

  return child;
}

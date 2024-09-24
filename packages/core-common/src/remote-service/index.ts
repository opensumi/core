import { ConstructorOf, Injectable, Injector, Optional, Token } from '@opensumi/di';

import { RPCProtocol } from '../types/rpc';

const RemoteServiceInstantiateFlag = Symbol('RemoteServiceInstantiateFlag');
const __remoteServiceInstantiateFlag = Symbol('RemoteServiceInstantiateFlag_internal');

@Injectable()
export abstract class RemoteService<Client = any> {
  readonly servicePath: string;
  protocol?: RPCProtocol<any>;

  private _clientId: string;
  private _client: Client;
  get rpcClient() {
    return this._client;
  }
  get clientId() {
    return this._clientId;
  }

  constructor(@Optional(RemoteServiceInstantiateFlag) flag: symbol) {
    if (flag !== __remoteServiceInstantiateFlag) {
      throw new Error('Cannot create RemoteService instance directly');
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
      useValue: __remoteServiceInstantiateFlag,
    },
  ]);

  fn(child);

  child.overrideProviders({
    token: RemoteServiceInstantiateFlag,
    useValue: 'avoid_use_autowired_to_get_remote_service',
    override: true,
  });

  return child;
}

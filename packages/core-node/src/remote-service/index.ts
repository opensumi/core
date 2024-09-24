import { Injectable, Injector, Optional } from '@opensumi/di';
import { RPCProtocol } from '@opensumi/ide-core-common/lib/types/rpc';

const RemoteServiceInstantiateFlag = Symbol('RemoteServiceInstantiateFlag');
const __remoteServiceInstantiateFlag = Symbol('RemoteServiceInstantiateFlag_internal');

@Injectable({ multiple: true })
export abstract class RemoteService {
  abstract readonly servicePath: string;
  protocol?: RPCProtocol<any>;

  private _clientId: string;
  private _client: any;
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

  init(clientId: string, client?: any) {
    this._clientId = clientId;
    this._client = client;
  }
}

/**
 * 如何使用
 * ```ts
 * @Autowired(MessageDataStore, { tag: RemoteServiceDataStore.Session })
 * private sessionDataStore: MessageDataStore;
 *
 * @Autowired(MessageDataStore, { tag: RemoteServiceDataStore.Persisted })
 * private persistedDataStore: MessageDataStore;
 * ```
 */
@Injectable({ multiple: true })
export abstract class RemoteServiceDataStore {
  static Session = 'session';
  static Persisted = 'persisted';

  readonly _dataStoreBrand = undefined;
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

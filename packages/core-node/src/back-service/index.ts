import { Injectable, Injector, Optional } from '@opensumi/di';
import { RPCProtocol } from '@opensumi/ide-core-common/lib/types/rpc';

const BackServiceInstantiateFlag = Symbol('BackServiceFlag');
const __BackServiceInstantiateFlag = Math.random().toString(36).substring(2);

@Injectable({ multiple: true })
export abstract class BackService {
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

  constructor(@Optional(BackServiceInstantiateFlag) flag: string) {
    if (flag !== __BackServiceInstantiateFlag) {
      throw new Error('Cannot create BackService instance directly');
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
 * @Autowired(MessageDataStore, { tag: 'session' })
 * private sessionDataStore: MessageDataStore;
 *
 * @Autowired(MessageDataStore, { tag: 'persisted' })
 * private persistedDataStore: MessageDataStore;
 * ```
 */
@Injectable({ multiple: true })
export abstract class BackServiceDataStore {
  static Session = 'session';
  static Persisted = 'persisted';

  readonly _dataStoreBrand = undefined;
}

export function createBackServiceChildInjector(injector: Injector, fn: (childInjector: Injector) => void): Injector {
  const child = injector.createChild([
    {
      token: BackServiceInstantiateFlag,
      useValue: __BackServiceInstantiateFlag,
    },
  ]);

  fn(child);

  child.overrideProviders({
    token: BackServiceInstantiateFlag,
    useValue: 'avoid_use_autowired_to_get_back_service',
    override: true,
  });

  return child;
}

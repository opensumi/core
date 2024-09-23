import { Injectable, Injector, Optional } from '@opensumi/di';

const BackServiceCreatingFlag = Symbol('BackServiceFlag');
const _BackServiceCreatingFlag = Math.random().toString(36).substring(2);

@Injectable({ multiple: true })
export abstract class BackService {
  abstract readonly servicePath: string;

  private _clientId: string;
  private _client: any;
  get rpcClient() {
    return this._client;
  }
  get clientId() {
    return this._clientId;
  }

  constructor(@Optional(BackServiceCreatingFlag) flag: string) {
    if (flag !== _BackServiceCreatingFlag) {
      throw new Error('Cannot create BackService instance directly');
    }
  }

  init(clientId: string, client?: any) {
    this._clientId = clientId;
    this._client = client;
  }
}

@Injectable({ multiple: true })
export abstract class BackDataStore {
  readonly _dataStoreBrand = undefined;
}

export function createBackServiceChildInjector(injector: Injector, fn: (childInjector: Injector) => void): Injector {
  const child = injector.createChild([
    {
      token: BackServiceCreatingFlag,
      useValue: _BackServiceCreatingFlag,
    },
  ]);

  fn(child);

  child.overrideProviders({
    token: BackServiceCreatingFlag,
    useValue: 'do_not_use_autowired_to_get_back_service',
    override: true,
  });

  return child;
}

import { Autowired, Injector } from '@opensumi/di';

import { DataStoreOptions, InMemoryDataStore } from './store';

const dataStore = {
  global: {} as Record<
    string,
    {
      token: symbol;
      options: DataStoreOptions | undefined;
    }
  >,
  session: {} as Record<
    string,
    {
      token: symbol;
      options: DataStoreOptions | undefined;
    }
  >,
} as const;

function generateToken(type: 'global' | 'session', token: string, options?: DataStoreOptions) {
  if (dataStore[type][token]) {
    // 同样的 token 只能被注入一次，options 也以第一次为准
    return dataStore[type][token].token;
  }

  const sym = Symbol(token);
  dataStore[type][token] = {
    token: sym,
    options,
  };
  return sym;
}

export type GDataStore<T, K = number> = InMemoryDataStore<T, K>;
export function GDataStore(token: string, options?: DataStoreOptions): PropertyDecorator {
  const sym = generateToken('global', token, options);

  return Autowired(sym, {
    tag: token,
  });
}

export type SessionDataStore<T, K = number> = InMemoryDataStore<T, K>;
export function SessionDataStore(token: string, options?: DataStoreOptions): PropertyDecorator {
  const sym = generateToken('session', token, options);

  return Autowired(sym, {
    tag: token,
  });
}

function _injectDataStores(type: 'global' | 'session', injector: Injector) {
  const stores = dataStore[type];
  if (stores) {
    injector.addProviders(
      ...Object.entries(stores).map(([_, opts]) => ({
        token: opts.token,
        useValue: new InMemoryDataStore(opts.options),
      })),
    );
  }
}

export function injectGDataStores(injector: Injector) {
  _injectDataStores('global', injector);
}

export function injectSessionDataStores(injector: Injector) {
  _injectDataStores('session', injector);
}

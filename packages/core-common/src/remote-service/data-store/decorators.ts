import { Autowired, Injector } from '@opensumi/di';

import { DataStoreOptions, InMemoryDataStore } from './store';

type DataStoreItem = Record<
  string,
  {
    sym: symbol;
    options: DataStoreOptions | undefined;
  }
>;

const dataStore = {
  GDataStore: {} as DataStoreItem,
  SessionDataStore: {} as DataStoreItem,
} as const;
type DataStoreType = keyof typeof dataStore;

function generateToken(type: DataStoreType, token: string, options?: DataStoreOptions) {
  if (dataStore[type][token]) {
    // 同样的 token 只能被注入一次，options 也以第一次为准
    return dataStore[type][token].sym;
  }

  const sym = Symbol(`${type}:${token}`);
  dataStore[type][token] = {
    sym,
    options,
  };
  return sym;
}

export type GDataStore<
  Item extends Record<any, any>,
  PrimaryKey = keyof Item,
  PrimaryKeyType = Item[PrimaryKey],
> = InMemoryDataStore<Item, PrimaryKey, PrimaryKeyType>;
export function GDataStore(token: string, options?: DataStoreOptions): PropertyDecorator {
  const sym = generateToken('GDataStore', token, options);

  return Autowired(sym);
}

export type SessionDataStore<
  Item extends Record<any, any>,
  PrimaryKey = keyof Item,
  PrimaryKeyType = Item[PrimaryKey],
> = InMemoryDataStore<Item, PrimaryKey, PrimaryKeyType>;
export function SessionDataStore(token: string, options?: DataStoreOptions): PropertyDecorator {
  const sym = generateToken('SessionDataStore', token, options);

  return Autowired(sym);
}

function _injectDataStores(type: DataStoreType, injector: Injector) {
  const stores = dataStore[type];
  if (stores) {
    injector.addProviders(
      ...Object.values(stores).map((opts) => ({
        token: opts.sym,
        useValue: new InMemoryDataStore(opts.options),
      })),
    );
  }
}

export function injectGDataStores(injector: Injector) {
  _injectDataStores('GDataStore', injector);
}

export function injectSessionDataStores(injector: Injector) {
  _injectDataStores('SessionDataStore', injector);
}

import { Autowired, Injector } from '@opensumi/di';

import { DataStoreOptions, InMemoryDataStore } from './store';

const dataStore = {
  global: {} as Record<string, DataStoreOptions | undefined>,
  session: {} as Record<string, DataStoreOptions | undefined>,
} as const;

function saveToken(type: 'global' | 'session', token: string, options?: DataStoreOptions) {
  if (dataStore[type][token]) {
    // 同样的 token 只能被注入一次，options 也以第一次为准
    return;
  }

  dataStore[type][token] = options;
}

export type GDataStore<T> = InMemoryDataStore<T>;
export function GDataStore(token: string, options?: DataStoreOptions): PropertyDecorator {
  saveToken('global', token, options);

  return Autowired(GDataStore, {
    tag: String(token),
  });
}

export type SessionDataStore<T> = InMemoryDataStore<T>;
export function SessionDataStore(token: string, options?: DataStoreOptions): PropertyDecorator {
  saveToken('session', token, options);

  return Autowired(SessionDataStore, {
    tag: String(token),
  });
}

function _injectDataStores(type: 'global' | 'session', injector: Injector) {
  const stores = dataStore[type];
  if (stores) {
    const token = type === 'global' ? GDataStore : SessionDataStore;

    injector.addProviders(
      ...Object.entries(stores).map(([tag, opts]) => ({
        token,
        useValue: new InMemoryDataStore(opts),
        tag,
        dropdownForTag: false,
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

import { Autowired, Injector } from '@opensumi/di';

import { DataStoreOptions, InMemoryDataStore } from './store';

const dataStore = {
  global: [] as [string, DataStoreOptions][],
  session: [] as [string, DataStoreOptions][],
} as const;

function addTokenTo(type: 'global' | 'session', token: string, options?: DataStoreOptions) {
  if (dataStore[type].find((v) => v[0] === token)) {
    // 同样的 token 只能被注入一次，options 也以第一次为准
    return;
  }

  dataStore[type].push([token, options || {}]);
}

export function GDataStore(token: string, options?: DataStoreOptions): PropertyDecorator {
  addTokenTo('global', token, options);

  return Autowired(GDataStore, {
    tag: String(token),
  });
}

export type GDataStore<T> = InMemoryDataStore<T>;

export function SessionDataStore(token: string, options?: DataStoreOptions): PropertyDecorator {
  addTokenTo('session', token, options);

  return Autowired(SessionDataStore, {
    tag: String(token),
  });
}

export type SessionDataStore<T> = InMemoryDataStore<T>;

function _injectDataStores(type: 'global' | 'session', injector: Injector) {
  const stores = dataStore[type];
  if (stores) {
    stores.forEach(([token, opts]) => {
      injector.addProviders({
        token: type === 'global' ? GDataStore : SessionDataStore,
        useValue: new InMemoryDataStore(opts),
        tag: String(token),
        dropdownForTag: false,
      });
    });
  }
}

export function injectGDataStores(injector: Injector) {
  _injectDataStores('global', injector);
}

export function injectSessionDataStores(injector: Injector) {
  _injectDataStores('session', injector);
}

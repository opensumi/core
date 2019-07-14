import { Disposable, DisposableCollection, Event, Emitter } from '@ali/ide-core-common';
import { PreferenceService } from './preference-service';
import { PreferenceSchema, OverridePreferenceName } from './preference-contribution';

export interface PreferenceChangeEvent<T> {
  readonly preferenceName: keyof T;
  readonly newValue?: T[keyof T];
  readonly oldValue?: T[keyof T];
  affects(resourceUri?: string, overrideIdentifier?: string): boolean;
}

export interface PreferenceEventEmitter<T> {
  readonly onPreferenceChanged: Event<PreferenceChangeEvent<T>>;
  readonly ready: Promise<void>;
}

export interface PreferenceRetrieval<T> {

  get<K extends keyof T>(preferenceName: K |
    {
      preferenceName: K,
      overrideIdentifier?: string,
    },                   defaultValue?: T[K], resourceUri?: string): T[K];
}

export type PreferenceProxy<T> = Readonly<T> & Disposable & PreferenceEventEmitter<T> & PreferenceRetrieval<T>;

export function createPreferenceProxy<T>(preferences: PreferenceService, schema: PreferenceSchema): PreferenceProxy<T> {
  const toDispose = new DisposableCollection();
  const onPreferenceChangedEmitter = new Emitter<PreferenceChangeEvent<T>>();
  toDispose.push(onPreferenceChangedEmitter);
  toDispose.push(preferences.onPreferenceChanged((e) => {
    const overridden = preferences.overriddenPreferenceName(e.preferenceName);
    const preferenceName: any = overridden ? overridden.preferenceName : e.preferenceName;
    if (schema.properties[preferenceName]) {
      const { newValue, oldValue } = e;
      // 让独立的Preference也可以感知到全局Preference的变化
      onPreferenceChangedEmitter.fire({
        newValue, oldValue, preferenceName,
        affects: (resourceUri, overrideIdentifier) => {
          if (overrideIdentifier !== undefined) {
            if (overridden && overridden.overrideIdentifier !== overrideIdentifier) {
              return false;
            }
          }
          return e.affects(resourceUri);
        },
      });
    }
  }));

  const unsupportedOperation = (_: any, __: string) => {
    throw new Error('Unsupported operation');
  };
  const getValue: PreferenceRetrieval<any>['get'] = (arg, defaultValue, resourceUri) => {
    const preferenceName = typeof arg === 'object' && arg.overrideIdentifier ?
      preferences.overridePreferenceName(arg as OverridePreferenceName) :
      arg as string;
    return preferences.get(preferenceName, defaultValue, resourceUri);
  };
  return new Proxy({}, {
    get: (_, property: string) => {
      if (schema.properties[property]) {
        return preferences.get(property);
      }
      if (property === 'onPreferenceChanged') {
        return onPreferenceChangedEmitter.event;
      }
      if (property === 'dispose') {
        return () => toDispose.dispose();
      }
      if (property === 'ready') {
        return preferences.ready;
      }
      if (property === 'get') {
        return getValue;
      }
      throw new Error(`unexpected property: ${property}`);
    },
    ownKeys: () => Object.keys(schema.properties),
    getOwnPropertyDescriptor: (_, property: string) => {
      if (schema.properties[property]) {
        return {
          enumerable: true,
          configurable: true,
        };
      }
      return {};
    },
    set: unsupportedOperation,
    deleteProperty: unsupportedOperation,
    defineProperty: unsupportedOperation,
  });
}

import { Disposable, Event, PreferenceScope } from '@ali/ide-core-common';
import { PreferenceService } from './preference-service';
import { PreferenceSchema } from './preference-contribution';

export interface PreferenceChangeEvent<T> {
  readonly preferenceName: keyof T;
  readonly newValue?: T[keyof T];
  readonly oldValue?: T[keyof T];
  affects(resourceUri?: string, overrideIdentifier?: string): boolean;
}

export interface PreferenceProxyOptions {
  prefix?: string;
  resourceUri?: string;
  language?: string;
  style?: 'flat' | 'deep' | 'both';
}

export interface PreferenceEventEmitter<T> {
  readonly onPreferenceChanged: Event<PreferenceChangeEvent<T>>;
  readonly ready: Promise<void>;
}

export interface PreferenceRetrieval<T> {

  get<K extends keyof T>(preferenceName: K, defaultValue?: T[K], resourceUri?: string): T[K];
}

export type PreferenceProxy<T> = Readonly<T> & Disposable & PreferenceEventEmitter<T> & PreferenceRetrieval<T>;

export function createPreferenceProxy<T>(preferences: PreferenceService, schema: PreferenceSchema, options?: PreferenceProxyOptions): PreferenceProxy<T> {
  const opts = options || {};
  const prefix = opts.prefix || '';
  const style = opts.style || 'flat';
  const isDeep = style === 'deep' || style === 'both';
  const isFlat = style === 'both' || style === 'flat';
  const onPreferenceChanged = (listener: (e: PreferenceChangeEvent<T>) => any, thisArgs?: any, disposables?: Disposable[]) => {
    const disposer = new Disposable();
    disposer.addDispose(preferences.onPreferencesChanged((changes) => {
      for (const key of Object.keys(changes)) {
        const e = changes[key];
        const preferenceName: any = e.preferenceName ;
        if (preferenceName.startsWith(prefix)) {
          if (schema.properties[preferenceName]) {
            if (opts.resourceUri) {
              if (e.affects(opts.resourceUri)) {
                if (opts.language && !preferences.hasLanguageSpecific(preferenceName, opts.language, opts.resourceUri)) {
                  continue;
                }
                listener(e as any);
              }
            } else {
              listener(e as any);
            }
          }
        }
      }
    }, thisArgs, disposables));
    // 添加语言相关 changes 变更
    if (opts.language) {
      disposer.addDispose(preferences.onLanguagePreferencesChanged((event) => {
        if (event.language === opts.language) {
          for (const key of Object.keys(event.changes)) {
            const e = event.changes[key];
            const preferenceName: any = e.preferenceName ;
            if (preferenceName.startsWith(prefix)) {
              if (schema.properties[preferenceName]) {
                if (opts.resourceUri) {
                  if (e.affects(opts.resourceUri)) {
                    listener(e as any);
                  }
                } else {
                  listener(e as any);
                }
              }
            }
          }
        }
      }, thisArgs, disposables));
    }
    return disposer;
  };

  const unsupportedOperation = (_: any, __: string) => {
    throw new Error('Unsupported operation');
  };

  const getValue: PreferenceRetrieval<any>['get'] = (preferenceName: any, defaultValue, resourceUri, language?: string) => {
    return preferences.get(preferenceName, defaultValue, resourceUri || opts.resourceUri, language || opts.language);
  };

  const ownKeys: () => string[] = () => {
    const properties: string[] = [];
    for (const p of Object.keys(schema.properties)) {
      if (p.startsWith(prefix)) {
        const idx = p.indexOf('.', prefix.length);
        if (idx !== -1 && isDeep) {
          const pre = p.substr(prefix.length, idx - prefix.length);
          if (properties.indexOf(pre) === -1) {
            properties.push(pre);
          }
        }
        const prop = p.substr(prefix.length);
        if (isFlat || prop.indexOf('.') === -1) {
          properties.push(prop);
        }
      }
    }
    return properties;
  };

  const set: (target: any, prop: string, value: any, receiver: any) => boolean = (_, property: string | symbol | number, value: any) => {
    if (typeof property !== 'string') {
      throw new Error(`unexpected property: ${String(property)}`);
    }
    if (style === 'deep' && property.indexOf('.') !== -1) {
      return false;
    }
    const fullProperty = prefix ? prefix + property : property;
    if (schema.properties[fullProperty]) {
      preferences.set(fullProperty, value, PreferenceScope.Default);
      return true;
    }
    const newPrefix = fullProperty + '.';
    for (const p of Object.keys(schema.properties)) {
      if (p.startsWith(newPrefix)) {
        const subProxy: { [k: string]: any } = createPreferenceProxy(preferences, schema, {
          prefix: newPrefix,
          resourceUri: opts.resourceUri,
          language: opts.language,
          style,
        });
        for (const k of Object.keys(value)) {
          subProxy[k] = value[k];
        }
      }
    }
    return false;
  };

  const get: (target: any, prop: string) => any = (_, property: string | symbol | number) => {
    if (typeof property !== 'string') {
      throw new Error(`unexpected property: ${String(property)}`);
    }
    const fullProperty = prefix ? prefix + property : property;
    if (isFlat || property.indexOf('.') === -1) {
      if (schema.properties[fullProperty]) {
        return preferences.get(fullProperty, undefined, opts.resourceUri, opts.language);
      }
    }
    if (property === 'onPreferenceChanged') {
      return onPreferenceChanged;
    }
    if (property === 'dispose') {
      return () => { /* do nothing */ };
    }
    if (property === 'ready') {
      return preferences.ready;
    }
    if (property === 'get') {
      return getValue;
    }
    if (property === 'toJSON') {
      return toJSON();
    }
    if (isDeep) {
      const newPrefix = fullProperty + '.';
      for (const p of Object.keys(schema.properties)) {
        if (p.startsWith(newPrefix)) {
          return createPreferenceProxy(preferences, schema, { prefix: newPrefix, resourceUri: opts.resourceUri, language: opts.language, style });
        }
      }
    }
    return undefined;
  };

  const toJSON = () => {
    const result: any = {};
    for (const k of ownKeys()) {
      result[k] = get(undefined, k);
    }
    return result;
  };

  return new Proxy({}, {
    get,
    ownKeys,
    getOwnPropertyDescriptor: (_, property: string) => {
      if (ownKeys().indexOf(property) !== -1) {
        return {
          enumerable: true,
          configurable: true,
        };
      }
      return {};
    },
    set,
    deleteProperty: unsupportedOperation,
    defineProperty: unsupportedOperation,
  });
}

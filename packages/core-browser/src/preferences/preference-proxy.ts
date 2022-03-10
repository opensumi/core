import { Disposable, Event, isObject, isUndefined, PreferenceScope } from '@opensumi/ide-core-common';

import { PreferenceSchema } from './preference-contribution';
import { PreferenceService } from './preference-service';

export interface PreferenceChangeEvent<T> {
  readonly preferenceName: keyof T;
  readonly newValue?: T[keyof T];
  readonly oldValue?: T[keyof T];
  affects(resourceUri?: string, overrideIdentifier?: string): boolean;
}

export interface PreferenceProxyOptions {
  /**
   * 所有配置的默认前缀
   */
  prefix?: string;
  /**
   * 获取或设置配置的默认资源路径
   */
  resourceUri?: string;
  /**
   * 对齐VSCode实现，overrideIdentifier主要用于实现针对不同编辑器设置不同配置的能力
   * 与原有的language设定一致
   *
   * 如 [markdown].editor.autoIndent、[json].editor.autoIndent 及 editor.autoIndent 等
   */
  overrideIdentifier?: string;
  /**
   * 用来指代获取一个配置时是否为“平面含义”上的获取
   *
   * 如：
   * a.b.c 在flat模式下为单个配置的值
   * deep模式下则可以为 a 配置下的 b 配置下的 c 的值
   * both指代同时在两种配置模式下检索值
   */
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

export function createPreferenceProxy<T>(
  preferences: PreferenceService,
  schema: PreferenceSchema,
  options?: PreferenceProxyOptions,
): PreferenceProxy<T> {
  const opts = options || {};
  const prefix = opts.prefix || '';
  const style = opts.style || 'flat';
  const isDeep = style === 'deep' || style === 'both';
  const isFlat = style === 'both' || style === 'flat';
  const onPreferenceChanged = (
    listener: (e: PreferenceChangeEvent<T>) => any,
    thisArgs?: any,
    disposables?: Disposable[],
  ) => {
    const disposer = new Disposable();
    disposer.addDispose(
      preferences.onPreferencesChanged(
        (changes) => {
          for (const key of Object.keys(changes)) {
            const e = changes[key];
            const preferenceName: any = e.preferenceName;
            if (preferenceName.startsWith(prefix)) {
              if (schema.properties[preferenceName]) {
                if (opts.resourceUri) {
                  if (e.affects(opts.resourceUri)) {
                    if (
                      opts.overrideIdentifier &&
                      !preferences.hasLanguageSpecific(preferenceName, opts.overrideIdentifier, opts.resourceUri)
                    ) {
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
        },
        thisArgs,
        disposables,
      ),
    );
    // 添加语言相关 changes 变更
    if (opts.overrideIdentifier) {
      disposer.addDispose(
        preferences.onLanguagePreferencesChanged(
          (event) => {
            if (event.overrideIdentifier === opts.overrideIdentifier) {
              for (const key of Object.keys(event.changes)) {
                const e = event.changes[key];
                const preferenceName: any = e.preferenceName;
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
          },
          thisArgs,
          disposables,
        ),
      );
    }
    return disposer;
  };

  const unsupportedOperation = (_: any, __: string) => {
    throw new Error('Unsupported operation');
  };

  const getValue: PreferenceRetrieval<any>['get'] = (
    preferenceName: any,
    defaultValue,
    resourceUri,
    overrideIdentifier?: string,
  ) =>
    preferences.get(
      preferenceName,
      defaultValue,
      resourceUri || opts.resourceUri,
      overrideIdentifier || opts.overrideIdentifier,
    );

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

  const set: (target: any, prop: string, value: any, receiver: any) => boolean = (
    _,
    property: string | symbol | number,
    value: any,
  ) => {
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
          overrideIdentifier: opts.overrideIdentifier,
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
        return preferences.get(fullProperty, undefined, opts.resourceUri, opts.overrideIdentifier);
      }
    }
    if (property === 'onPreferenceChanged') {
      return onPreferenceChanged;
    }
    if (property === 'dispose') {
      return () => {
        /* do nothing */
      };
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
        // 这里实际上要求 Configuration 在注册的时候声明全量配置名
        // 如，获取 a.b, 则要求 Configuration 声明时必须为 a.b.c
        if (p.startsWith(newPrefix)) {
          return createPreferenceProxy(preferences, schema, {
            prefix: newPrefix,
            resourceUri: opts.resourceUri,
            overrideIdentifier: opts.overrideIdentifier,
            style,
          });
        }
      }

      // 升级 Monaco 0.20.0 版本后，Monaco 中的ConfigurationService会尝试通过配置全称获取配置值
      // 如，直接获取 a.b.c.d 配置值
      // 下面的逻辑兼容了通过 a.b 获取 a.b.c， a.b.c.d 的方式
      let value;
      let parentSegment = fullProperty;
      const segments: string[] = [];
      for (let index; parentSegment && isUndefined(value); ) {
        index = parentSegment.lastIndexOf('.');
        // 查找到对应值后退出查询
        segments.push(parentSegment.substring(index + 1));
        parentSegment = parentSegment.substring(0, index);
        if (parentSegment in schema.properties) {
          value = get(_, parentSegment);
        }
      }

      let segment;
      while (isObject(value) && (segment = segments.pop())) {
        // 进一步遍历获取配置值
        value = value[segment];
      }
      return segments.length ? undefined : value;
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

  return new Proxy(
    {},
    {
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
    },
  );
}

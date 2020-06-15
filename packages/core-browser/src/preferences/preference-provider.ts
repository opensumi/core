import { Injectable } from '@ali/common-di';
import { IDisposable, DisposableCollection, Emitter, Event, URI, Deferred, JSONUtils, JSONValue, Resource } from '@ali/ide-core-common';
import { PreferenceScope } from '@ali/ide-core-common/lib/preferences/preference-scope';

export interface IResolvedPreferences {
  default: {[key: string]: any};
  languageSpecific: {
    [languageId: string]: {[key: string]: any},
  };
}
export interface PreferenceProviderDataChange {
  readonly preferenceName: string;
  readonly newValue?: any;
  readonly oldValue?: any;
  readonly scope: PreferenceScope;
  readonly domain?: string[];
}

export interface PreferenceProviderDataChanges {
  default: {
    [preferenceName: string]: PreferenceProviderDataChange;
  };
  languageSpecific: ILanguagePreferenceProviderDataChanges;
}

export interface ILanguagePreferenceProviderDataChanges {
  [languageId: string]: {
    [preferenceName: string]: PreferenceProviderDataChange;
  };
}

export interface PreferenceResolveResult<T> {
  configUri?: URI;
  value?: T;
  scope?: PreferenceScope;
  // 是否存在来自针对语言的设置
  languageSpecific?: boolean;
}

@Injectable()
export abstract class PreferenceProvider implements IDisposable {

  public readonly name: string;

  protected readonly onDidPreferencesChangedEmitter = new Emitter<PreferenceProviderDataChanges>();
  public readonly onDidPreferencesChanged: Event<PreferenceProviderDataChanges> = this.onDidPreferencesChangedEmitter.event;

  protected readonly toDispose = new DisposableCollection();

  protected readonly _ready = new Deferred<void>();

  public resource: Promise<Resource>;

  constructor() {
    this.toDispose.push(this.onDidPreferencesChangedEmitter);
  }

  public dispose(): void {
    this.toDispose.dispose();
  }

  /**
   * 处理事件监听中接收到的Event数据对象
   * 以便后续接收到数据后能确认来自那个配置项的值
   */
  protected emitPreferencesChangedEvent(changes: PreferenceProviderDataChanges | PreferenceProviderDataChange[]): void {
    if (Array.isArray(changes)) {
      const prefChanges: PreferenceProviderDataChanges = {default: {}, languageSpecific: {}};
      for (const change of changes) {
        prefChanges.default[change.preferenceName] = change;
      }
      this.onDidPreferencesChangedEmitter.fire(prefChanges);
    } else {
      this.onDidPreferencesChangedEmitter.fire(changes);
    }
  }

  public get<T>(preferenceName: string, resourceUri?: string, language?: string): T | undefined {
    return this.resolve<T>(preferenceName, resourceUri, language).value;
  }

  public resolve<T>(preferenceName: string, resourceUri?: string, language?: string): PreferenceResolveResult<T> {
    const value = this.getPreferences(resourceUri, language)[preferenceName];
    if (value !== undefined) {
      return {
        value,
        configUri: this.getConfigUri(resourceUri),
      };
    }
    return {};
  }

  public abstract getPreferences(resourceUri?: string, language?: string): { [p: string]: any };

  public abstract getLanguagePreferences(resourceUri?: string, language?: string): { [language: string]: {[p: string]: any} };

  public abstract setPreference(key: string, value: any, resourceUri?: string, language?: string): Promise<boolean>;

  /**
   * 返回promise，当 preference provider 已经可以提供配置时返回resolved
   */
  get ready() {
    return this._ready.promise;
  }

  /**
   * 默认返回undefined
   */
  public getDomain(): string[] | undefined {
    return undefined;
  }

  /**
   * 默认返回undefined
   */
  public getConfigUri(resourceUri?: string): URI | undefined {
    return undefined;
  }

  public static merge(source: JSONValue | undefined, target: JSONValue): JSONValue {
    if (source === undefined || !JSONUtils.isObject(source)) {
      return JSONUtils.deepCopy(target);
    }
    if (JSONUtils.isPrimitive(target)) {
      return {};
    }
    for (const key of Object.keys(target)) {
      const value = (target as any)[key];
      if (key in source) {
        if (JSONUtils.isObject(source[key]) && JSONUtils.isObject(value)) {
          this.merge(source[key], value);
          continue;
        }
      }
      source[key] = JSONUtils.deepCopy(value);
    }
    return source;
  }

}

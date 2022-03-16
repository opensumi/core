import { Injectable, Autowired } from '@opensumi/di';
import {
  Deferred,
  Event,
  Emitter,
  DisposableCollection,
  IDisposable,
  Disposable,
  URI,
  isUndefined,
  isEmptyObject,
  LRUMap,
  deepClone,
} from '@opensumi/ide-core-common';

import { PreferenceConfigurations } from './preference-configurations';
import { PreferenceSchemaProvider } from './preference-contribution';
import {
  PreferenceProvider,
  PreferenceProviderDataChange,
  PreferenceProviderDataChanges,
  PreferenceResolveResult,
} from './preference-provider';
import { PreferenceScope } from './preference-scope';

export interface PreferenceChange {
  readonly preferenceName: string;
  readonly newValue?: any;
  readonly oldValue?: any;
  readonly scope: PreferenceScope;
  affects(resourceUri?: string): boolean;
}

export class PreferenceChangeImpl implements PreferenceChange {
  constructor(private change: PreferenceProviderDataChange) {}

  get preferenceName() {
    return this.change.preferenceName;
  }
  get newValue() {
    return this.change.newValue;
  }
  get oldValue() {
    return this.change.oldValue;
  }
  get scope(): PreferenceScope {
    return this.change.scope;
  }

  public affects(resourceUri?: string): boolean {
    const resourcePath = resourceUri && new URI(resourceUri).path;
    const domain = this.change.domain;
    return !resourcePath || !domain || domain.some((uri) => new URI(uri).path.relativity(resourcePath) >= 0);
  }
}

export interface PreferenceChanges {
  [preferenceName: string]: PreferenceChange;
}
export const PreferenceService = Symbol('PreferenceService');

export interface PreferenceService extends IDisposable {
  readonly ready: Promise<void>;
  /**
   * 获取一个配置的值
   * @param preferenceName  配置名称
   * @param defaultValue 默认值
   * @param resourceUri 资源路径
   * @param overrideIdentifier 一般指语言偏好设置
   */
  get<T>(preferenceName: string, defaultValue: T, resourceUri?: string, overrideIdentifier?: string): T;
  get<T>(preferenceName: string, defaultValue?: T, resourceUri?: string, overrideIdentifier?: string): T | undefined;

  /**
   * 是否一个配置在指定 scope 存在针对语言的配置
   * @param preferenceName 配置名称
   * @param overrideIdentifier 语言
   * @param resourceUri 资源路径
   */
  hasLanguageSpecific(preferenceName: any, overrideIdentifier: string, resourceUri: string): boolean;

  /**
   * 设置一个配置的值
   * @param preferenceName 偏好名称
   * @param value 设置值
   * @param scope 目标scope级别 如 User, Workspace
   * @param resourceUri 资源路径
   * @param overrideIdentifier 一般指语言偏好设置
   */
  set(
    preferenceName: string,
    value: any,
    scope?: PreferenceScope,
    resourceUri?: string,
    overrideIdentifier?: string,
  ): Promise<void>;

  onPreferenceChanged: Event<PreferenceChange>;

  onPreferencesChanged: Event<PreferenceChanges>;

  onLanguagePreferencesChanged: Event<{ overrideIdentifier: string; changes: PreferenceChanges }>;

  inspect<T>(
    preferenceName: string,
    resourceUri?: string,
    language?: string,
  ):
    | {
        preferenceName: string;
        defaultValue: T | undefined;
        globalValue: T | undefined; // User Preference
        workspaceValue: T | undefined; // Workspace Preference
        workspaceFolderValue: T | undefined; // Folder Preference
      }
    | undefined;

  getProvider(scope: PreferenceScope): PreferenceProvider | undefined;

  resolve<T>(
    preferenceName: string,
    defaultValue?: T,
    resourceUri?: string,
    language?: string,
    untilScope?: PreferenceScope,
  ): PreferenceResolveResult<T>;

  /**
   * 都走 onPreferenceChanged 再用if判断性能太差了
   * TODO: 将只监听一个偏好的使用这个方法
   * @param preferenceName
   */
  onSpecificPreferenceChange(preferenceName, listener: (change: PreferenceChange) => void): IDisposable;
}

export const PreferenceProviderProvider = Symbol('PreferenceProviderProvider');
export type PreferenceProviderProvider = (scope: PreferenceScope, uri?: URI) => PreferenceProvider;

@Injectable()
export class PreferenceServiceImpl implements PreferenceService {
  protected readonly onPreferenceChangedEmitter = new Emitter<PreferenceChange>();
  public readonly onPreferenceChanged = this.onPreferenceChangedEmitter.event;

  protected readonly onPreferencesChangedEmitter = new Emitter<PreferenceChanges>();
  public readonly onPreferencesChanged = this.onPreferencesChangedEmitter.event;

  private readonly onLanguagePreferencesChangedEmitter = new Emitter<{
    overrideIdentifier: string;
    changes: PreferenceChanges;
  }>();
  public readonly onLanguagePreferencesChanged = this.onLanguagePreferencesChangedEmitter.event;

  protected readonly toDispose = new DisposableCollection(
    this.onPreferenceChangedEmitter,
    this.onPreferencesChangedEmitter,
  );

  @Autowired(PreferenceSchemaProvider)
  protected readonly schema: PreferenceSchemaProvider;

  @Autowired(PreferenceProvider, { tag: PreferenceScope.Default })
  protected readonly defaultPreferenceProvider: PreferenceProvider;

  @Autowired(PreferenceProviderProvider)
  protected readonly providerProvider: PreferenceProviderProvider;

  @Autowired(PreferenceConfigurations)
  protected readonly configurations: PreferenceConfigurations;

  protected readonly preferenceProviders = new Map<PreferenceScope, PreferenceProvider>();

  private specificEmitters = new Map<string, Emitter<PreferenceChange>>();

  /**
   * 使用 getPreferences()方法获取
   */
  protected preferences: { [key: string]: any } = {};

  /**
   * 缓存，减少每次都 doResolve 的开销
   */
  private cachedPreference = new LRUMap<string, LRUMap<string, PreferenceResolveResult<any>>>(1000, 500);

  constructor() {
    this.init();
  }

  protected async init(): Promise<void> {
    this.toDispose.push(Disposable.create(() => this._ready.reject(new Error('preference service is disposed'))));
    this.initializeProviders();
  }

  public dispose(): void {
    this.toDispose.dispose();
  }

  public onSpecificPreferenceChange(preferenceName, listener) {
    if (!this.specificEmitters.has(preferenceName)) {
      this.specificEmitters.set(preferenceName, new Emitter());
    }
    return this.specificEmitters.get(preferenceName)!.event(listener);
  }

  protected readonly _ready = new Deferred<void>();
  get ready(): Promise<void> {
    return this._ready.promise;
  }

  /**
   * 初始化并创建默认的PreferenceProvider
   */
  protected async initializeProviders(): Promise<void> {
    try {
      const scopes = PreferenceScope.getScopes();
      for (const scope of scopes) {
        const provider = this.providerProvider(scope);
        this.preferenceProviders.set(scope, provider);
        // 获得每个Scope下的PreferenceProvider后，监听配置变化进行变更合并
        this.toDispose.push(
          provider.onDidPreferencesChanged((changes) => {
            // 对应作用域的配置修改至通知对应Provider
            // 当 PreferenceService 中依然能收到一次更新通知
            const preferenceNames = Object.keys(changes.default);
            const defaultChange = {};
            for (const name of preferenceNames) {
              if (changes.default[name].scope === scope) {
                defaultChange[name] = changes.default[name];
              }
            }
            if (isEmptyObject(defaultChange)) {
              return;
            }
            this.reconcilePreferences({
              default: defaultChange,
              languageSpecific: changes.languageSpecific,
            });
          }),
        );
        await provider.ready;
      }
      this._ready.resolve();
    } catch (e) {
      this._ready.reject(e);
    }
  }

  /**
   * 合并preference 变化
   * @param changes
   */
  protected reconcilePreferences(changes: PreferenceProviderDataChanges): void {
    const changesToEmit: PreferenceChanges = {};
    const languageSpecificChangesToEmit: {
      [languageId: string]: PreferenceChanges;
    } = {};
    const acceptChange = (change: PreferenceProviderDataChange, language) => {
      this.cachedPreference.delete(change.preferenceName);
      if (language) {
        if (!languageSpecificChangesToEmit[language]) {
          languageSpecificChangesToEmit[language] = {};
        }
        languageSpecificChangesToEmit[language][change.preferenceName] = new PreferenceChangeImpl(change);
      } else {
        changesToEmit[change.preferenceName] = new PreferenceChangeImpl(change);
      }
    };

    // 尝试获取Preference变更带来的配置修改
    this.tryAcceptChanges(changes.default, acceptChange);
    Object.keys(changes.languageSpecific).forEach((language) => {
      // 尝试获取Preference变更带来的语言配置修改
      this.tryAcceptChanges(changes.languageSpecific[language], acceptChange, language);
    });

    // 触发配置变更事件
    const changedPreferenceNames = Object.keys(changesToEmit);
    if (changedPreferenceNames.length > 0) {
      this.onPreferencesChangedEmitter.fire(changesToEmit);
    }
    changedPreferenceNames.forEach((preferenceName) => {
      this.onPreferenceChangedEmitter.fire(changesToEmit[preferenceName]);
      if (this.specificEmitters.has(preferenceName)) {
        this.specificEmitters.get(preferenceName)!.fire(changesToEmit[preferenceName]);
      }
    });
    Object.keys(languageSpecificChangesToEmit).forEach((language) => {
      this.onLanguagePreferencesChangedEmitter.fire({
        overrideIdentifier: language,
        changes: languageSpecificChangesToEmit[language],
      });
    });
  }

  /**
   * 尝试处理配置修改带来的配置变化
   *
   * @private
   * @param {{[preferenceName: string]: PreferenceProviderDataChange}} changes
   * @param {(change: PreferenceProviderDataChange, language?: string) => void} acceptChange
   * @param {string} [language]
   * @memberof PreferenceServiceImpl
   */
  private tryAcceptChanges(
    changes: { [preferenceName: string]: PreferenceProviderDataChange },
    acceptChange: (change: PreferenceProviderDataChange, language?: string) => void,
    language?: string,
  ) {
    for (const preferenceName of Object.keys(changes)) {
      let change = changes[preferenceName];

      if (this.schema.isValidInScope(preferenceName, PreferenceScope.Folder)) {
        acceptChange(change, language);
        continue;
      }
      for (const scope of PreferenceScope.getReversedScopes()) {
        if (this.schema.isValidInScope(preferenceName, scope)) {
          const provider = this.getProvider(scope);
          if (provider) {
            const value = provider.get(preferenceName, change.domain ? change.domain[0] : undefined, language);
            if (scope > change.scope && value !== undefined) {
              // 配置项已在更高的作用域下被定义，无法处理当前作用域的变化
              break;
            } else if (scope === change.scope && change.newValue !== undefined) {
              // 配置项修改为了非 `undefined` 的值
              acceptChange(change, language);
              break;
            } else if (scope < change.scope && change.newValue === undefined && value !== undefined) {
              // 对应配置项已经改为 `undefined`, 使用低一级作用域下的配置值
              change = {
                ...change,
                newValue: value,
                scope,
              };
              acceptChange(change, language);
              break;
            } else if (scope === PreferenceScope.Default && change.newValue === undefined && value === undefined) {
              // 到达这里, 说明已经没有针对语言的配置，因此需要将其变为非语言指定的值
              change = {
                ...change,
                newValue: this.get(preferenceName, undefined, change.domain ? change.domain[0] : undefined),
                scope,
              };
              acceptChange(change, language);
              break;
            }
          }
        }
      }
    }
  }

  /**
   * 获取对应scope下的preferenceProvider
   * @protected
   * @param {PreferenceScope} scope
   * @returns {(PreferenceProvider | undefined)}
   * @memberof PreferenceServiceImpl
   */
  public getProvider(scope: PreferenceScope): PreferenceProvider | undefined {
    return this.preferenceProviders.get(scope);
  }

  /**
   * 获取指定资源的Preferences
   * @param {string} [resourceUri]
   * @returns {{ [key: string]: any }}
   * @memberof PreferenceServiceImpl
   */
  public getPreferences(resourceUri?: string): { [key: string]: any } {
    const preferences: { [key: string]: any } = {};
    for (const preferenceName of this.schema.getPreferenceNames()) {
      preferences[preferenceName] = this.get(preferenceName, undefined, resourceUri);
    }
    return preferences;
  }

  /**
   * 插叙是否有对应配置
   * @param {string} preferenceName
   * @param {string} [resourceUri]
   * @returns {boolean}
   * @memberof PreferenceServiceImpl
   */
  public has(preferenceName: string, resourceUri?: string, language?: string): boolean {
    return this.get(preferenceName, undefined, resourceUri, language) !== undefined;
  }

  public get<T>(preferenceName: string, defaultValue?: T, resourceUri?: string, language?: string): T | undefined {
    return this.resolve<T>(preferenceName, defaultValue, resourceUri, language).value;
  }

  public lookUp<T>(key: string): PreferenceResolveResult<T> {
    let value;
    let reset;
    if (!key) {
      return {
        value,
      };
    }
    const parts = key.split('.');
    if (!parts || parts.length === 0) {
      return {
        value,
      };
    }
    for (let i = parts.length - 1; i > 0; i--) {
      value = this.doResolve(parts.slice(0, i).join('.')).value;
      if (value) {
        reset = parts.slice(i);
        break;
      }
    }
    while (reset && reset.length > 0) {
      value = value[reset.shift()];
    }
    return { value };
  }

  public resolve<T>(
    preferenceName: string,
    defaultValue?: T,
    resourceUri?: string,
    language?: string,
    untilScope?: PreferenceScope,
  ): PreferenceResolveResult<T> {
    const result = this.doResolve(preferenceName, defaultValue, resourceUri, untilScope, language);
    if (typeof result.value === 'undefined') {
      return this.lookUp(preferenceName);
    }
    return result;
  }

  public async set(
    preferenceName: string,
    value: any,
    scope: PreferenceScope | undefined,
    resourceUri?: string,
  ): Promise<void> {
    await this.ready;
    const resolvedScope = !isUndefined(scope)
      ? scope
      : !resourceUri
      ? PreferenceScope.Workspace
      : PreferenceScope.Folder;
    // TODO: 错误日志错误码机制
    if (resolvedScope === PreferenceScope.User && this.configurations.isSectionName(preferenceName.split('.', 1)[0])) {
      throw new Error(`Unable to write to User Settings because ${preferenceName} does not support for global scope.`);
    }
    if (resolvedScope === PreferenceScope.Folder && !resourceUri) {
      throw new Error('Unable to write to Folder Settings because no resource is provided.');
    }
    const provider = this.getProvider(resolvedScope);
    if (provider && (await provider.setPreference(preferenceName, value, resourceUri))) {
      return;
    }
    throw new Error(`Unable to write to ${PreferenceScope.getScopeNames(resolvedScope)[0]} Settings.`);
  }

  public hasLanguageSpecific(preferenceName: string, language: string, resourceUri?: string): boolean {
    return !!this.doResolve(preferenceName, undefined, resourceUri, undefined, language).languageSpecific;
  }

  public getBoolean(preferenceName: string): boolean | undefined;
  public getBoolean(preferenceName: string, defaultValue: boolean): boolean;
  // eslint-disable-next-line @typescript-eslint/unified-signatures
  public getBoolean(preferenceName: string, defaultValue: boolean, resourceUri: string): boolean;
  public getBoolean(preferenceName: string, defaultValue?: boolean, resourceUri?: string): boolean | undefined {
    const value = resourceUri
      ? this.get(preferenceName, defaultValue, resourceUri)
      : this.get(preferenceName, defaultValue);
    return value !== null && value !== undefined ? !!value : defaultValue;
  }

  public getString(preferenceName: string): string | undefined;
  public getString(preferenceName: string, defaultValue: string): string;
  // eslint-disable-next-line @typescript-eslint/unified-signatures
  public getString(preferenceName: string, defaultValue: string, resourceUri: string): string;
  public getString(preferenceName: string, defaultValue?: string, resourceUri?: string): string | undefined {
    const value = resourceUri
      ? this.get(preferenceName, defaultValue, resourceUri)
      : this.get(preferenceName, defaultValue);
    if (value === null || value === undefined) {
      return defaultValue;
    }
    return value.toString();
  }

  public getNumber(preferenceName: string): number | undefined;
  public getNumber(preferenceName: string, defaultValue: number): number;
  // eslint-disable-next-line @typescript-eslint/unified-signatures
  public getNumber(preferenceName: string, defaultValue: number, resourceUri: string): number;
  public getNumber(preferenceName: string, defaultValue?: number, resourceUri?: string): number | undefined {
    const value = resourceUri
      ? this.get(preferenceName, defaultValue, resourceUri)
      : this.get(preferenceName, defaultValue);
    if (value === null || value === undefined) {
      return defaultValue;
    }
    if (typeof value === 'number') {
      return value;
    }
    return Number(value);
  }

  public inspect<T>(
    preferenceName: string,
    resourceUri?: string,
    language?: string,
  ):
    | {
        preferenceName: string;
        defaultValue: T | undefined;
        globalValue: T | undefined; // User Preference
        workspaceValue: T | undefined; // Workspace Preference
        workspaceFolderValue: T | undefined; // Folder Preference
      }
    | undefined {
    const defaultValue = this.inspectInScope<T>(preferenceName, PreferenceScope.Default, resourceUri, language);
    const globalValue = this.inspectInScope<T>(preferenceName, PreferenceScope.User, resourceUri, language);
    const workspaceValue = this.inspectInScope<T>(preferenceName, PreferenceScope.Workspace, resourceUri, language);
    const workspaceFolderValue = this.inspectInScope<T>(preferenceName, PreferenceScope.Folder, resourceUri, language);

    return { preferenceName, defaultValue, globalValue, workspaceValue, workspaceFolderValue };
  }
  protected inspectInScope<T>(
    preferenceName: string,
    scope: PreferenceScope,
    resourceUri?: string,
    language?: string,
  ): T | undefined {
    const value = this.doInspectInScope<T>(preferenceName, scope, resourceUri, language);
    return value;
  }

  protected doHas(preferenceName: string, resourceUri?: string): boolean {
    return this.doGet(preferenceName, undefined, resourceUri) !== undefined;
  }

  protected doInspectInScope<T>(
    preferenceName: string,
    scope: PreferenceScope,
    resourceUri?: string,
    language?: string,
  ): T | undefined {
    const provider = this.getProvider(scope);
    return provider && provider.get<T>(preferenceName, resourceUri, language);
  }

  protected doGet<T>(preferenceName: string, defaultValue?: T, resourceUri?: string): T | undefined {
    return this.doResolve(preferenceName, defaultValue, resourceUri).value;
  }

  /**
   * 获取配置值
   *
   * @protected
   * @template T
   * @param {string} preferenceName 配置项名称
   * @param {T} [defaultValue] 默认值
   * @param {string} [resourceUri] 资源路径
   * @param {PreferenceScope} [untilScope] 最高作用域
   * @param {string} [language] 语言标识符
   * @returns {PreferenceResolveResult<T>}
   * @memberof PreferenceServiceImpl
   */
  protected doResolve<T>(
    preferenceName: string,
    defaultValue?: T,
    resourceUri?: string,
    untilScope?: PreferenceScope,
    language?: string,
  ): PreferenceResolveResult<T> {
    if (!this.cachedPreference.has(preferenceName)) {
      this.cachedPreference.set(preferenceName, new LRUMap(500, 200));
    }
    const cache = this.cachedPreference.get(preferenceName)!;
    const cacheKey = cacheHash(language, untilScope, resourceUri);
    if (!cache.has(cacheKey)) {
      cache.set(cacheKey, this.doResolveWithOutCache<T>(preferenceName, resourceUri, untilScope, language));
    }
    const result = cache.get(cacheKey)!;
    if (result.value === undefined) {
      result.value = defaultValue;
    }
    return result;
  }

  protected doResolveWithOutCache<T>(
    preferenceName: string,
    resourceUri?: string,
    untilScope?: PreferenceScope,
    language?: string,
  ): PreferenceResolveResult<T> {
    const result: PreferenceResolveResult<T> = { scope: PreferenceScope.Default };
    const scopes = untilScope
      ? PreferenceScope.getScopes().filter((s) => s <= untilScope)
      : PreferenceScope.getScopes();
    for (const scope of scopes) {
      if (this.schema.isValidInScope(preferenceName, scope)) {
        const provider = this.getProvider(scope);
        if (provider) {
          const { configUri, value } = provider.resolve<T>(preferenceName, resourceUri);
          // 这里配置值为空对象时，我们也视为非有效值
          if (!isUndefined(value) && !isEmptyObject(value)) {
            result.configUri = configUri;
            // 按作用域逐级合并配置值
            result.value = PreferenceProvider.merge(result.value as any, value as any) as any;
            result.scope = scope;
          }
        }
      }
    }

    // 添加语言的设置
    if (language) {
      for (const scope of scopes) {
        if (this.schema.isValidInScope(preferenceName, scope)) {
          const provider = this.getProvider(scope);
          if (provider) {
            const { configUri, value, languageSpecific } = provider.resolve<T>(preferenceName, resourceUri, language);
            if (value !== undefined) {
              result.configUri = configUri;
              result.value = PreferenceProvider.merge(result.value as any, value as any) as any;
              result.scope = scope;
              result.languageSpecific = result.languageSpecific || languageSpecific;
            }
          }
        }
      }
    }

    return {
      configUri: result.configUri,
      value: !isUndefined(result.value) ? deepClone(result.value) : undefined,
      scope: result.scope || PreferenceScope.Default,
      languageSpecific: result.languageSpecific,
    };
  }
}

function cacheHash(language?: string, untilScope?: PreferenceScope, resourceUri?: string) {
  return `${language ? `${language}:::` : ''}${untilScope ? `${untilScope}:::` : ''}${resourceUri}` || 'default';
}

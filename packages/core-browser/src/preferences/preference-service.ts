import { Injectable, Autowired } from '@opensumi/di';
import {
  Deferred,
  Emitter,
  DisposableCollection,
  Disposable,
  URI,
  isUndefined,
  isEmptyObject,
  objects,
  LRUMap,
} from '@opensumi/ide-core-common';

import { PreferenceConfigurations } from './preference-configurations';
import { PreferenceSchemaProvider } from './preference-contribution';
import { PreferenceProvider, PreferenceProviderDataChange, PreferenceProviderDataChanges } from './preference-provider';
import { PreferenceScope } from './preference-scope';
import {
  PreferenceChange,
  PreferenceChanges,
  PreferenceProviderProvider,
  PreferenceResolveResult,
  PreferenceService,
} from './types';

const { deepClone } = objects;

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
   * ?????? getPreferences()????????????
   */
  protected preferences: { [key: string]: any } = {};

  /**
   * ???????????????????????? doResolve ?????????
   */
  private cachedPreference = new LRUMap<string, LRUMap<string, PreferenceResolveResult<any>>>(1000, 500);

  constructor() {
    this.init();
  }

  protected async init(): Promise<void> {
    // this.toDispose.push(Disposable.create(() => this._ready.reject(new Error('preference service is disposed'))));
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
   * ???????????????????????????PreferenceProvider
   */
  protected async initializeProviders(): Promise<void> {
    const scopes = PreferenceScope.getScopes();
    const promises: Array<Promise<void>> = [];
    for (const scope of scopes) {
      const provider = this.providerProvider(scope);
      this.preferenceProviders.set(scope, provider);
      // ????????????Scope??????PreferenceProvider??????????????????????????????????????????
      this.toDispose.push(
        provider.onDidPreferencesChanged((changes) => {
          // ?????????????????????????????????????????????Provider
          // ??? PreferenceService ????????????????????????????????????
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
      promises.push(provider.ready);
    }
    return Promise.all(promises)
      .then(() => {
        this._ready.resolve();
      })
      .catch((e) => {
        this._ready.reject(e);
      });
  }

  /**
   * ??????preference ??????
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

    // ????????????Preference???????????????????????????
    this.tryAcceptChanges(changes.default, acceptChange);
    Object.keys(changes.languageSpecific).forEach((language) => {
      // ????????????Preference?????????????????????????????????
      this.tryAcceptChanges(changes.languageSpecific[language], acceptChange, language);
    });

    // ????????????????????????
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
   * ?????????????????????????????????????????????
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
              // ????????????????????????????????????????????????????????????????????????????????????
              break;
            } else if (scope === change.scope && change.newValue !== undefined) {
              // ???????????????????????? `undefined` ??????
              acceptChange(change, language);
              break;
            } else if (scope < change.scope && change.newValue === undefined && value !== undefined) {
              // ??????????????????????????? `undefined`, ???????????????????????????????????????
              change = {
                ...change,
                newValue: value,
                scope,
              };
              acceptChange(change, language);
              break;
            } else if (scope === PreferenceScope.Default && change.newValue === undefined && value === undefined) {
              // ????????????, ???????????????????????????????????????????????????????????????????????????????????????
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
   * ????????????scope??????preferenceProvider
   * @protected
   * @param {PreferenceScope} scope
   * @returns {(PreferenceProvider | undefined)}
   * @memberof PreferenceServiceImpl
   */
  public getProvider(scope: PreferenceScope): PreferenceProvider | undefined {
    return this.preferenceProviders.get(scope);
  }

  /**
   * ?????????????????????Preferences
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
   * ???????????????????????????
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
    // TODO: ???????????????????????????
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

  public async update(preferenceName: string, value: any, defaultScope = PreferenceScope.User) {
    const resolved = this.resolve(preferenceName);
    // ??????????????? PreferenceScope.Default ?????????????????????
    if (resolved?.scope) {
      this.set(preferenceName, value, resolved.scope);
    } else {
      this.set(preferenceName, value, defaultScope);
    }
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
   * ???????????????
   *
   * @protected
   * @template T
   * @param {string} preferenceName ???????????????
   * @param {T} [defaultValue] ?????????
   * @param {string} [resourceUri] ????????????
   * @param {PreferenceScope} [untilScope] ???????????????
   * @param {string} [language] ???????????????
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
    const scopes = !isUndefined(untilScope)
      ? PreferenceScope.getScopes().filter((s) => s <= untilScope)
      : PreferenceScope.getScopes();
    for (const scope of scopes) {
      if (this.schema.isValidInScope(preferenceName, scope)) {
        const provider = this.getProvider(scope);
        if (provider) {
          const { configUri, value } = provider.resolve<T>(preferenceName, resourceUri);
          // ????????????????????????????????????????????????????????????
          if (!isUndefined(value) && !isEmptyObject(value)) {
            result.configUri = configUri;
            // ?????????????????????????????????
            result.value = PreferenceProvider.merge(result.value as any, value as any) as any;
            result.scope = scope;
          }
        }
      }
    }

    // ?????????????????????
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
  return (
    `${language ? `${language}:::` : ''}${!isUndefined(untilScope) ? `${untilScope}:::` : ''}${resourceUri || ''}` ||
    'default'
  );
}

import * as jsoncparser from 'jsonc-parser';
import { Injectable, Autowired } from '@ali/common-di';
import { JSONUtils, URI, Resource, ResourceProvider, Disposable } from '@ali/ide-core-browser';
import {
  PreferenceProvider,
  PreferenceSchemaProvider,
  PreferenceScope,
  PreferenceProviderDataChange,
  PreferenceConfigurations,
} from '@ali/ide-core-browser';

@Injectable()
export abstract class AbstractResourcePreferenceProvider extends PreferenceProvider {

  protected preferences: { [key: string]: any } = {};
  protected resource: Promise<Resource>;

  @Autowired(ResourceProvider) protected readonly resourceProvider: ResourceProvider;
  @Autowired(PreferenceSchemaProvider) protected readonly schemaProvider: PreferenceSchemaProvider;

  @Autowired(PreferenceConfigurations)
  protected readonly configurations: PreferenceConfigurations;

  constructor() {
    super();
    this.init();
  }

  protected async init(): Promise<void> {
    const uri = this.getUri();
    this.resource = this.resourceProvider(uri);
    // 尝试读取preferences初始内容
    this.readPreferences()
      .then(() => this._ready.resolve())
      .catch(() => this._ready.resolve());

    const resource = await this.resource;
    this.toDispose.push(resource);
    if (resource.onDidChangeContents) {
      // 配置文件改变时，重新读取配置
      this.toDispose.push(resource.onDidChangeContents(() => {
        return  this.readPreferences();
      }));
    }
    this.toDispose.push(Disposable.create(() => this.reset()));
  }

  protected abstract getUri(): URI;
  protected abstract getScope(): PreferenceScope;

  getConfigUri(): URI;
  getConfigUri(resourceUri: string | undefined): URI | undefined;
  getConfigUri(resourceUri?: string): URI | undefined {
    if (!resourceUri) {
      return this.getUri();
    }
    return this.loaded && this.contains(resourceUri) ? this.getUri() : undefined;
  }

  contains(resourceUri: string | undefined): boolean {
    if (!resourceUri) {
      return true;
    }
    const domain = this.getDomain();
    if (!domain) {
      return true;
    }
    const resourcePath = new URI(resourceUri).path;
    return domain.some((uri) => new URI(uri).path.relativity(resourcePath) >= 0);
  }

  getPreferences(resourceUri?: string): { [key: string]: any } {
    return this.loaded && this.contains(resourceUri) ? this.preferences : {};
  }

  async setPreference(key: string, value: any, resourceUri?: string): Promise<boolean> {
    if (!this.contains(resourceUri)) {
      return false;
    }
    const path = this.getPath(key);
    if (!path) {
      return false;
    }
    const resource = await this.resource;
    if (!resource.saveContents) {
      return false;
    }
    const content = ((await this.readContents()) || '').trim();
    if (!content && value === undefined) {
      return true;
    }
    try {
      let newContent = '';
      if (path.length || value !== undefined) {
        const formattingOptions = { tabSize: 3, insertSpaces: true, eol: '' };
        const edits = jsoncparser.modify(content, path, value, { formattingOptions });
        newContent = jsoncparser.applyEdits(content, edits);
      }
      await resource.saveContents(newContent);
    } catch (e) {
      const message = `Failed to update the value of ${key}.`;
      console.error(`${message} ${e.toString()}`);
      return false;
    }
    await this.readPreferences();
    return true;
  }

  protected getPath(preferenceName: string): string[] | undefined {
    return [preferenceName];
  }

  protected loaded = false;
  protected async readPreferences(): Promise<void> {
    const newContent = await this.readContents();
    this.loaded = newContent !== undefined;
    const newPrefs = newContent ? this.getParsedContent(newContent) : {};
    this.handlePreferenceChanges(newPrefs);
  }

  protected async readContents(): Promise<string | undefined> {
    try {
      const resource = await this.resource;
      return await resource.readContents();
    } catch {
      return undefined;
    }
  }

  protected getParsedContent(content: string): { [key: string]: any } {
    const jsonData = this.parse(content);

    const preferences: { [key: string]: any } = {};
    if (typeof jsonData !== 'object') {
      return preferences;
    }
    const uri = this.getUri();
    // tslint:disable-next-line:forin
    for (const preferenceName in jsonData) {
      const preferenceValue = jsonData[preferenceName];
      if (!this.validate(preferenceName, preferenceValue)) {
        console.warn(`Preference ${preferenceName} in ${uri} is invalid.`);
        continue;
      }
      if (this.schemaProvider.testOverrideValue(preferenceName, preferenceValue)) {
        // tslint:disable-next-line:forin
        for (const overriddenPreferenceName in preferenceValue) {
          const overriddenValue = preferenceValue[overriddenPreferenceName];
          preferences[`${preferenceName}.${overriddenPreferenceName}`] = overriddenValue;
        }
      } else {
        preferences[preferenceName] = preferenceValue;
      }
    }
    return preferences;
  }

  protected validate(preferenceName: string, preferenceValue: any): boolean {
    // 如果配置内容是从.vscode 目录下读取，即使无效也引入使用
    if (this.configurations.getPath(this.getUri()) !== this.configurations.getPaths()[0]) {
      return true;
    }
    return preferenceValue === undefined || this.schemaProvider.validate(preferenceName, preferenceValue);
  }

  protected parse(content: string): any {
    content = content.trim();
    if (!content) {
      return undefined;
    }
    const strippedContent = jsoncparser.stripComments(content);
    return jsoncparser.parse(strippedContent);
  }

  protected handlePreferenceChanges(newPrefs: { [key: string]: any }): void {
    const oldPrefs = Object.assign({}, this.preferences);
    this.preferences = newPrefs;
    const prefNames = new Set([...Object.keys(oldPrefs), ...Object.keys(newPrefs)]);
    const prefChanges: PreferenceProviderDataChange[] = [];
    const uri = this.getUri();
    for (const prefName of prefNames.values()) {
      const oldValue = oldPrefs[prefName];
      const newValue = newPrefs[prefName];
      const schemaProperties = this.schemaProvider.getCombinedSchema().properties[prefName];
      if (schemaProperties) {
        const scope = schemaProperties.scope;
        // do not emit the change event if the change is made out of the defined preference scope
        if (!this.schemaProvider.isValidInScope(prefName, this.getScope())) {
          console.warn(`Preference ${prefName} in ${uri} can only be defined in scopes: ${PreferenceScope.getScopeNames(scope).join(', ')}.`);
          continue;
        }
      }
      if (newValue === undefined && oldValue !== newValue
        || oldValue === undefined && newValue !== oldValue // JSONUtils.deepEqual() does not support handling `undefined`
        || !JSONUtils.deepEqual(oldValue, newValue)) {
        prefChanges.push({
          preferenceName: prefName, newValue, oldValue, scope: this.getScope(), domain: this.getDomain(),
        });
      }
    }

    if (prefChanges.length > 0) { // do not emit the change event if the pref value is not changed
      this.emitPreferencesChangedEvent(prefChanges);
    }
  }

  protected reset(): void {
    const preferences = this.preferences;
    this.preferences = {};
    const changes: PreferenceProviderDataChange[] = [];
    for (const prefName of Object.keys(preferences)) {
      const value = preferences[prefName];
      if (value !== undefined) {
        changes.push({
          preferenceName: prefName, newValue: undefined, oldValue: value, scope: this.getScope(), domain: this.getDomain(),
        });
      }
    }
    if (changes.length > 0) {
      this.emitPreferencesChangedEvent(changes);
    }
  }

}

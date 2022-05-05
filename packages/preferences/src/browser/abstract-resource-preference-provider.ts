import * as jsoncparser from 'jsonc-parser';

import { Injectable, Autowired } from '@opensumi/di';
import {
  JSONUtils,
  URI,
  Disposable,
  isUndefined,
  PreferenceProviderDataChanges,
  ILogger,
  IResolvedPreferences,
  Throttler,
  FileChange,
} from '@opensumi/ide-core-browser';
import {
  PreferenceProvider,
  PreferenceSchemaProvider,
  PreferenceScope,
  PreferenceProviderDataChange,
  PreferenceConfigurations,
} from '@opensumi/ide-core-browser';
import { FILE_SCHEME, IFileServiceClient } from '@opensumi/ide-file-service';

import { IPreferenceTask, USER_STORAGE_SCHEME } from '../common';

// vscode 对语言的setting是根据这种格式来的
// "[json]": { "editor.formatter": "xxxx" }
// 对其进行兼容
const OVERRIDE_PROPERTY = '\\[(.*)\\]$';
export const OVERRIDE_PROPERTY_PATTERN = new RegExp(OVERRIDE_PROPERTY);

@Injectable()
export abstract class AbstractResourcePreferenceProvider extends PreferenceProvider {
  protected preferences: IResolvedPreferences = {
    default: {},
    languageSpecific: {},
  };

  @Autowired(PreferenceSchemaProvider)
  protected readonly schemaProvider: PreferenceSchemaProvider;

  @Autowired(PreferenceConfigurations)
  protected readonly configurations: PreferenceConfigurations;

  @Autowired(IFileServiceClient)
  protected readonly fileSystem: IFileServiceClient;

  @Autowired(ILogger)
  private logger: ILogger;

  private preferenceThrottler: Throttler = new Throttler();
  private preferenceTasks: IPreferenceTask[] = [];

  constructor() {
    super();
    this.listen();
  }

  protected listen() {
    if (this.fileSystem.handlesScheme(FILE_SCHEME) && this.fileSystem.handlesScheme(USER_STORAGE_SCHEME)) {
      this.init();
    } else {
      const disposable = this.fileSystem.onFileProviderChanged((scheme: string[]) => {
        if (this.fileSystem.handlesScheme(FILE_SCHEME) && this.fileSystem.handlesScheme(USER_STORAGE_SCHEME)) {
          this.init();
          disposable.dispose();
        }
      });
    }
  }

  protected async init(): Promise<void> {
    // 尝试读取preferences初始内容
    this.readPreferences()
      .then(() => this._ready.resolve())
      .catch(() => this._ready.resolve());

    const uri = this.getUri();
    const watcher = await this.fileSystem.watchFileChanges(uri);
    // 配置文件改变时，重新读取配置
    this.toDispose.push(watcher);
    watcher.onFilesChanged((e: FileChange[]) => {
      const effected = e.find((file) => file.uri === uri.toString());
      if (effected) {
        return this.readPreferences();
      }
    });
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
    // 获取configUri不需要等待配置读取完应该就可以读取
    return this.contains(resourceUri) ? this.getUri() : undefined;
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

  getPreferences(resourceUri?: string, language?: string) {
    return this.loaded && this.contains(resourceUri) ? this.getOnePreference(language) : undefined;
  }

  getLanguagePreferences(resourceUri?: string) {
    return this.loaded && this.contains(resourceUri) ? this.preferences.languageSpecific : undefined;
  }

  getOnePreference(language?: string): { [key: string]: any } {
    if (language) {
      return this.preferences.languageSpecific[language] || {};
    } else {
      return this.preferences.default;
    }
  }

  async resolvePreferenceTasks(tasks: IPreferenceTask[]) {
    const uri = this.getUri();
    // 读取配置时同时更新一下资源信息，防止写入时对异步写入情况的错误判断
    this.resource = this.fileSystem.getFileStat(uri.toString());
    let resource = await this.resource;
    let content = ((await this.readContents()) || '').trim();

    // 将多次配置修改合并为一次文件内容变更
    for (const task of tasks) {
      const { path, value } = task;
      if ((!content || path.length === 0) && isUndefined(value)) {
        continue;
      }
      const formattingOptions = { tabSize: 2, insertSpaces: true, eol: '' };
      const edits = jsoncparser.modify(content, path, value, { formattingOptions });
      content = jsoncparser.applyEdits(content, edits);
    }

    try {
      if (!resource) {
        // 当资源不存在又需要写入数据时，创建对应文件
        resource = await this.fileSystem.createFile(uri.toString());
      }
      await this.fileSystem.setContent(resource, content);
      await this.readPreferences(content);
      return true;
    } catch (e) {
      this.logger.error(`${e.toString()}`);
      return false;
    }
  }

  /**
   * 配置变更队列处理函数
   */
  doSetPreferenceTask() {
    const tasks = this.preferenceTasks.slice(0);
    this.preferenceTasks = [];
    return this.resolvePreferenceTasks(tasks);
  }

  async doSetPreference(key: string, value: any, resourceUri?: string, language?: string): Promise<boolean> {
    if (!this.contains(resourceUri)) {
      return false;
    }
    const path = this.getPath(key, language);
    if (!path) {
      return false;
    }
    // 这里将每次配置变更的参数构造为一个 IPreferenceTask
    this.preferenceTasks.push({ path, key, value });
    return await this.preferenceThrottler.queue<boolean>(this.doSetPreferenceTask.bind(this));
  }

  protected getPath(preferenceName: string, language?: string): string[] | undefined {
    if (language) {
      return [`[${language}]`, preferenceName];
    }
    return [preferenceName];
  }

  protected loaded = false;
  protected async readPreferences(content?: string): Promise<void> {
    const newContent = content || (await this.readContents());
    this.loaded = !isUndefined(newContent);
    const newPrefs = newContent ? this.getParsedContent(newContent) : { default: {}, languageSpecific: {} };
    this.handlePreferenceChanges(newPrefs);
  }

  protected async readContents(): Promise<string | undefined> {
    try {
      const uri = this.getUri();
      const { content } = await this.fileSystem.readFile(uri.toString());
      return content.toString();
    } catch {
      return undefined;
    }
  }

  protected getParsedContent(content: string): IResolvedPreferences {
    const jsonData = this.parse(content);

    const preferences: IResolvedPreferences = {
      default: {},
      languageSpecific: {},
    };
    if (typeof jsonData !== 'object') {
      return preferences;
    }
    for (const preferenceName of Object.keys(jsonData)) {
      const preferenceValue = jsonData[preferenceName];
      // 这里由于插件的schema注册较晚，在第一次获取配置时会校验不通过导致取不到值，读取暂时去掉校验逻辑
      if (OVERRIDE_PROPERTY_PATTERN.test(preferenceName)) {
        const language = preferenceName.match(OVERRIDE_PROPERTY_PATTERN)![1];
        preferences.languageSpecific[language] = preferences.languageSpecific[language] || {};
        // eslint-disable-next-line guard-for-in
        for (const overriddenPreferenceName in preferenceValue) {
          const overriddenValue = preferenceValue[overriddenPreferenceName];
          preferences.languageSpecific[language][`${overriddenPreferenceName}`] = overriddenValue;
        }
      } else {
        preferences.default[preferenceName] = preferenceValue;
      }
    }
    return preferences;
  }

  protected validate(preferenceName: string, preferenceValue: any): boolean {
    if (this.configurations.getPath(this.getUri()) !== this.configurations.getPaths()[0]) {
      return true;
    }
    return isUndefined(preferenceValue) || this.schemaProvider.validate(preferenceName, preferenceValue).valid;
  }

  protected parse(content: string): any {
    content = content.trim();
    if (!content) {
      return undefined;
    }
    const strippedContent = jsoncparser.stripComments(content);
    return jsoncparser.parse(strippedContent);
  }

  protected handlePreferenceChanges(newPrefs: IResolvedPreferences): void {
    const oldPrefs = Object.assign({}, this.preferences);
    this.preferences = newPrefs;
    const changes: PreferenceProviderDataChanges = this.collectChanges(this.preferences, oldPrefs);

    if (Object.keys(changes.default).length > 0 || Object.keys(changes.languageSpecific).length > 0) {
      this.emitPreferencesChangedEvent(changes);
    }
  }

  protected reset(): void {
    const preferences = this.preferences;
    this.preferences = { default: {}, languageSpecific: {} };
    const changes: PreferenceProviderDataChanges = this.collectChanges(this.preferences, preferences);

    if (Object.keys(changes.default).length > 0 || Object.keys(changes.languageSpecific).length > 0) {
      this.emitPreferencesChangedEvent(changes);
    }
  }

  private collectChanges(newPref: IResolvedPreferences, oldPref: IResolvedPreferences): PreferenceProviderDataChanges {
    const changes: PreferenceProviderDataChanges = {
      default: this.collectOneChanges(newPref.default, oldPref.default),
      languageSpecific: {},
    };
    const languages = new Set<string>([
      ...Object.keys(newPref.languageSpecific),
      ...Object.keys(oldPref.languageSpecific),
    ]);
    for (const language of languages) {
      const languageChange = this.collectOneChanges(
        newPref.languageSpecific[language],
        oldPref.languageSpecific[language],
      );
      if (Object.keys(languageChange).length > 0) {
        changes.languageSpecific[language] = languageChange;
      }
    }
    return changes;
  }

  private collectOneChanges(
    newPref: { [name: string]: any },
    oldPref: { [name: string]: any },
  ): { [preferenceName: string]: PreferenceProviderDataChange } {
    const keys = new Set([...Object.keys(oldPref || {}), ...Object.keys(newPref || {})]);
    const changes: { [preferenceName: string]: PreferenceProviderDataChange } = {};
    const uri = this.getUri();

    for (const prefName of keys) {
      const oldValue = oldPref[prefName];
      const newValue = newPref[prefName];
      const schemaProperties = this.schemaProvider.getCombinedSchema().properties[prefName];
      if (schemaProperties) {
        const scope = schemaProperties.scope;
        // do not emit the change event if the change is made out of the defined preference scope
        if (!this.schemaProvider.isValidInScope(prefName, this.getScope())) {
          this.logger.warn(
            `Preference ${prefName} in ${uri} can only be defined in scopes: ${PreferenceScope.getScopeNames(
              scope,
            ).join(', ')}.`,
          );
          continue;
        }
      }
      if (
        (isUndefined(newValue) && oldValue !== newValue) ||
        (isUndefined(oldValue) && newValue !== oldValue) || // JSONUtils.deepEqual() does not support handling `undefined`
        !JSONUtils.deepEqual(oldValue, newValue)
      ) {
        changes[prefName] = {
          preferenceName: prefName,
          newValue,
          oldValue,
          scope: this.getScope(),
          domain: this.getDomain(),
        };
      }
    }
    return changes;
  }
}

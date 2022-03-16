import { Injectable, Optional, Autowired } from '@opensumi/di';
import {
  getDebugLogger,
  registerLocalizationBundle,
  getCurrentLanguageInfo,
  Uri,
  Deferred,
  URI,
  WithEventBus,
  replaceNlsField,
} from '@opensumi/ide-core-common';
import { StaticResourceService } from '@opensumi/ide-static-resource/lib/browser';

import { JSONType, ExtensionService, IExtension, IExtensionProps, IExtensionMetaData } from '../common';

import { ExtensionMetadataService } from './metadata.service';
import { AbstractExtInstanceManagementService, ExtensionDidActivatedEvent, ExtensionWillActivateEvent } from './types';

const metaDataSymbol = Symbol.for('metaDataSymbol');

@Injectable({ multiple: true })
export class Extension extends WithEventBus implements IExtension {
  public readonly id: string;
  public readonly extensionId: string;
  public readonly name: string;
  public readonly extraMetadata: JSONType = {};
  public readonly packageJSON: JSONType;
  public readonly defaultPkgNlsJSON: JSONType | undefined;
  public readonly packageNlsJSON: JSONType | undefined;
  public readonly path: string;
  public readonly realPath: string;
  public readonly extendConfig: JSONType;
  public readonly enableProposedApi: boolean;
  public readonly extensionLocation: Uri;
  public readonly uri?: Uri;

  private _activated = false;
  private _activating?: Deferred<void>;

  private _enabled: boolean;

  private readonly logger = getDebugLogger();

  @Autowired(ExtensionMetadataService)
  private readonly extMetadataService: ExtensionMetadataService;

  @Autowired(ExtensionService)
  private readonly extensionService: ExtensionService;

  @Autowired()
  private readonly staticResourceService: StaticResourceService;

  @Autowired(AbstractExtInstanceManagementService)
  private readonly extensionInstanceManageService: AbstractExtInstanceManagementService;

  private pkgLocalizedField = new Map<string, string>();

  constructor(
    @Optional(metaDataSymbol) private extensionData: IExtensionMetaData,
    @Optional(Symbol()) public isUseEnable: boolean,
    @Optional(Symbol()) public isBuiltin: boolean,
    @Optional(Symbol()) public isDevelopment: boolean,
  ) {
    super();

    this._enabled = isUseEnable;
    this.packageJSON = this.extensionData.packageJSON;
    this.defaultPkgNlsJSON = this.extensionData.defaultPkgNlsJSON;
    this.packageNlsJSON = this.extensionData.packageNlsJSON;
    this.id = this.extensionData.id;
    this.extensionId = this.extensionData.extensionId;
    this.name = this.packageJSON.name;
    this.extraMetadata = this.extensionData.extraMetadata;
    this.path = this.extensionData.path;
    this.uri = this.extensionData.uri;
    this.realPath = this.extensionData.realPath;
    this.extendConfig = this.extensionData.extendConfig || {};
    this.enableProposedApi = Boolean(this.extensionData.packageJSON.enableProposedApi);

    // 这里还是直接用 this.uri，
    // 如果用 path, window 下路径为 C:\a，此时直接 parse 会变成 scheme 为 C 的 uri，转换不太对
    // 对于 node 层 extension.scanner 标准下 uri 为 file，纯前端下为自定义实现的 kt-ext，因此可直接使用
    // 不太确定为啥这里的 uri 类型为可选
    this.extensionLocation = this.staticResourceService.resolveStaticResource(URI.from(this.uri!)).codeUri;
  }

  localize(key: string) {
    // 因为可能在没加载语言包之前就会获取 packageJson 的内容
    // 所以这里缓存的值可以会为 undefined 或者空字符串，这两者都属于无效内容
    // 对于无效内容要重新获取
    if (!this.pkgLocalizedField.get(key)) {
      const nlsValue = replaceNlsField(this.packageJSON[key], this.id);
      this.pkgLocalizedField.set(key, nlsValue!);
      return nlsValue || this.packageJSON[key];
    }
    return this.pkgLocalizedField.get(key);
  }

  get activated() {
    return this._activated;
  }

  get enabled() {
    return this._enabled;
  }

  set enabled(enable: boolean) {
    this._enabled = enable;
  }

  disable() {
    if (!this._enabled) {
      return;
    }
    this.extMetadataService.dispose();
    this._enabled = false;
    super.dispose();
  }

  enable() {
    if (this._enabled) {
      return;
    }

    this._enabled = true;
  }

  /**
   * 激活插件的 nls 语言包
   * 激活插件的 contributes 贡献点
   */
  async contributeIfEnabled() {
    if (this._enabled) {
      this.addDispose(this.extMetadataService);
      this.logger.log(`${this.name} extensionMetadataService.run`);
      if (this.packageNlsJSON) {
        registerLocalizationBundle(
          {
            ...getCurrentLanguageInfo(),
            contents: this.packageNlsJSON as any,
          },
          this.id,
        );
      }

      if (this.defaultPkgNlsJSON) {
        registerLocalizationBundle(
          {
            languageId: 'default',
            languageName: 'en-US',
            localizedLanguageName: 'English',
            contents: this.defaultPkgNlsJSON as any,
          },
          this.id,
        );
      }

      await this.extMetadataService.run(this);
    }
  }

  async activate(visited = new Set<string>()) {
    const deps = this.packageJSON?.extensionDependencies || [];

    visited.add(this.extensionId);

    for (const dep of deps) {
      const nextDepId = typeof dep === 'string' ? dep : Object.keys(dep)[0];
      // in order to  break cycle
      // 循环依赖是不符合开发预期的行为，我们在这里直接跳过
      if (visited.has(nextDepId)) {
        continue;
      }
      const nextExt = this.extensionInstanceManageService.getExtensionInstanceByExtId(nextDepId);
      nextExt && (await nextExt.activate(visited));
    }

    if (this._activated) {
      return;
    }

    const skipActivate = await this.eventBus.fireAndAwait(new ExtensionWillActivateEvent(this));
    if (skipActivate.length > 0 && skipActivate[0].result) {
      this._activated = true;
      return Promise.resolve();
    }

    if (this._activating) {
      return this._activating.promise;
    }
    this._activating = new Deferred();

    this.extensionService
      .activeExtension(this)
      .then(() => {
        this._activated = true;
        this.eventBus.fire(new ExtensionDidActivatedEvent(this.toJSON()));
        this._activating?.resolve();
      })
      .catch((e) => {
        this.logger.error(e);
        this._activated = false;
        this._activating?.reject(e);
      });

    return this._activating.promise;
  }

  get contributes() {
    return this.packageJSON.contributes;
  }

  public reset() {
    this._activated = false;
    this._activating = undefined;
  }

  toJSON(): IExtensionProps {
    return {
      id: this.id,
      extensionId: this.extensionId,
      name: this.name,
      displayName: this.localize('displayName'),
      activated: this.activated,
      enabled: this.enabled,
      packageJSON: this.packageJSON,
      defaultPkgNlsJSON: this.defaultPkgNlsJSON,
      packageNlsJSON: this.packageNlsJSON,
      path: this.path,
      realPath: this.realPath,
      isUseEnable: this.isUseEnable,
      extendConfig: this.extendConfig,
      enableProposedApi: this.enableProposedApi,
      extraMetadata: this.extraMetadata,
      isBuiltin: this.isBuiltin,
      isDevelopment: this.isDevelopment,
      extensionLocation: this.extensionLocation,
    };
  }
}

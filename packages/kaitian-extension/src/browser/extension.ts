import { Injectable, Optional, Autowired } from '@ali/common-di';
import { JSONType, ExtensionService, IExtension, IExtensionProps, IExtensionMetaData } from '../common';
import { getDebugLogger, registerLocalizationBundle, getCurrentLanguageInfo, Emitter, Uri, Deferred, URI, WithEventBus } from '@ali/ide-core-common';
import { StaticResourceService } from '@ali/ide-static-resource/lib/browser';
import { ExtensionMetadataService } from './metadata.service';
import { ExtensionWillActivateEvent } from './types';

const metaDataSymbol = Symbol.for('metaDataSymbol');
const extensionServiceSymbol = Symbol.for('extensionServiceSymbol');

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

  private _activated: boolean = false;
  private _activating: Deferred<void>;

  private _enabled: boolean;

  private readonly logger = getDebugLogger();

  @Autowired(ExtensionMetadataService)
  extMetadataService: ExtensionMetadataService;

  @Autowired()
  private staticResourceService: StaticResourceService;

  constructor(
    @Optional(metaDataSymbol) private extensionData: IExtensionMetaData,
    @Optional(extensionServiceSymbol) private extensionService: ExtensionService,
    @Optional(Symbol()) public isUseEnable: boolean,
    @Optional(Symbol()) public isBuiltin: boolean,
    @Optional(Symbol()) public isDevelopment: boolean,
    private didActivated: Emitter<IExtensionProps>,
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
    this.extensionLocation = this.staticResourceService.resolveStaticResource(new URI(Uri.file(this.path))).codeUri;
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
  }

  enable() {
    if (this._enabled) {
      return;
    }

    this._enabled = true;
  }

  async contributeIfEnabled() {
    if (this._enabled) {
      this.addDispose(this.extMetadataService);
      this.logger.log(`${this.name} extensionMetadataService.run`);
      if (this.packageNlsJSON) {
        registerLocalizationBundle({
          ...getCurrentLanguageInfo(),
          contents: this.packageNlsJSON as any,
        }, this.id);
      }

      if (this.defaultPkgNlsJSON) {
        registerLocalizationBundle({
          languageId: 'default',
          languageName: 'en-US',
          localizedLanguageName: '英文(默认)',
          contents: this.defaultPkgNlsJSON as any,
        }, this.id);
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
      const nextExt = this.extensionService.getExtensionByExtId(nextDepId);
      nextExt && await nextExt.activate(visited);
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
    // initKaitianBrowserAPIDependency 时依赖 extension 实例，所以在插件激活前做这一步
    await this.extensionService.initKaitianBrowserAPIDependency(this);

    this.extensionService.activeExtension(this).then(() => {
      this._activated = true;
      this.didActivated.fire(this.toJSON());
      this._activating.resolve();
    }).catch((e) => {
      this.logger.error(e);
    });

    return this._activating.promise;
  }

  get contributes() {
    return this.packageJSON.contributes;
  }

  toJSON(): IExtensionProps {
    return {
      id: this.id,
      extensionId: this.extensionId,
      name: this.name,
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

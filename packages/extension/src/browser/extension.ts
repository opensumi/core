import { Injectable, Optional, Autowired } from '@opensumi/di';
import {
  getDebugLogger,
  registerLocalizationBundle,
  getCurrentLanguageInfo,
  WithEventBus,
  replaceNlsField,
  Uri,
  Deferred,
  URI,
} from '@opensumi/ide-core-browser';
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

    // ????????????????????? this.uri???
    // ????????? path, window ???????????? C:\a??????????????? parse ????????? scheme ??? C ??? uri??????????????????
    // ?????? node ??? extension.scanner ????????? uri ??? file???????????????????????????????????? kt-ext????????????????????????
    // ??????????????????????????? uri ???????????????
    this.extensionLocation = this.staticResourceService.resolveStaticResource(URI.from(this.uri!)).codeUri;
  }

  localize(key: string) {
    // ??????????????????????????????????????????????????? packageJson ?????????
    // ???????????????????????????????????? undefined ???????????????????????????????????????????????????
    // ?????????????????????????????????
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
   * ??????????????? nls ?????????
   * ??????????????? contributes ?????????
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
      // ???????????????????????????????????????????????????????????????????????????
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

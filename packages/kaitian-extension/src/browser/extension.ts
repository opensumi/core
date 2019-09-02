import {Injectable, Optional, Autowired, Inject} from '@ali/common-di';
import { JSONType, ExtensionService, IExtension, IExtensionProps, IExtensionMetaData } from '../common';
import { getLogger, Disposable } from '@ali/ide-core-common';
import { VSCodeMetaService } from './vscode/meta';

const metaDataSymbol = Symbol.for('metaDataSymbol');
const extensionServiceSymbol = Symbol.for('extensionServiceSymbol');

@Injectable({multiple: true})
export class Extension extends Disposable implements IExtension {
  public readonly id: string;
  public readonly name: string;
  public readonly extraMetadata: JSONType = {};
  public readonly packageJSON: JSONType;
  public readonly path: string;
  public readonly realPath: string;
  public readonly extendConfig: JSONType;
  public readonly enableProposedApi: boolean;

  private _activated: boolean;
  private _activating: Promise<void> | null = null;

  private _enabled: boolean;
  private _enabling: Promise<void> | null = null;

  private logger = getLogger();

  @Autowired(VSCodeMetaService)
  vscodeMetaService: VSCodeMetaService;

  constructor(
    @Optional(metaDataSymbol) private extensionData: IExtensionMetaData,
    @Optional(extensionServiceSymbol) private exensionService: ExtensionService,
    @Optional(Symbol()) public isEnable: boolean) {
    super();

    this.packageJSON = this.extensionData.packageJSON;
    this.id = `${this.packageJSON.publisher}.${this.packageJSON.name}`;
    this.name = this.packageJSON.name;
    this.extraMetadata = this.extensionData.extraMetadata;
    this.path = this.extensionData.path;
    this.realPath = this.extensionData.realPath;
    this.extendConfig = this.extensionData.extendConfig || {};
    this.enableProposedApi = Boolean(this.extensionData.packageJSON.enableProposedApi);
  }

  get activated() {
    return this._activated;
  }

  get enabled() {
    return this._enabled;
  }

  async enable() {
    if (this._enabled) {
      return ;
    }
    if (this._enabling) {
      return this._enabling;
    }
    // this.addDispose(this.vscodeMetaService)
    this.logger.log(`${this.name} vscodeMetaService.run`);
    await this.vscodeMetaService.run(this);

    this._enabling = null;
  }

  async activate() {
    if (this._activated) {
      return ;
    }

    if (this._activating) {
      return this._activating;
    }

    this._activating = this.exensionService.activeExtension(this).then(() => {
      this._activated = true;
    }).catch((e) => {
      this.logger.error(e);
    });

    return this._activating;
  }

  toJSON(): IExtensionProps {
    return {
      id: this.id,
      name: this.name,
      activated: this.activated,
      enabled: this.enabled,
      packageJSON: this.packageJSON,
      path: this.path,
      realPath: this.realPath,
      isEnable: this.isEnable,
      extendConfig: this.extendConfig,
      enableProposedApi: this.enableProposedApi,
      extraMetadata: this.extraMetadata,
    };
  }

}

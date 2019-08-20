import {Injectable, Optional, Autowired, Inject} from '@ali/common-di';
import { JSONType, IExtensionMetaData, ExtensionService } from '../common';
import { getLogger, Disposable } from '@ali/ide-core-common';
import { VSCodeMetaService } from './vscode/meta';

const metaDataSymbol = Symbol.for('metaDataSymbol');
const extensionServiceSymbol = Symbol.for('extensionServiceSymbol');

@Injectable({multiple: true})
export class Extension extends Disposable {
  public readonly id: string;
  public readonly name: string;
  public readonly extraMetadata: JSONType = {};
  public readonly packageJSON: JSONType;
  public readonly path: string;
  public readonly realPath: string;
  public readonly extendConfig: JSONType;

  private _activated: boolean;
  private _activating: Promise<void> | null = null;

  private _enabled: boolean;
  private _enabling: Promise<void> | null = null;

  private logger = getLogger();

  @Autowired(VSCodeMetaService)
  vscodeMetaService: VSCodeMetaService;

  constructor(
    @Optional(metaDataSymbol) private extensionMetaData: IExtensionMetaData,
    @Optional(extensionServiceSymbol) private exensionService: ExtensionService) {
    super();

    this.packageJSON = this.extensionMetaData.packageJSON;
    this.id = `${this.packageJSON.publisher}.${this.packageJSON.name}`;
    this.name = this.packageJSON.name;
    this.extraMetadata = this.extensionMetaData.extraMetadata;
    this.path = this.extensionMetaData.path;
    this.realPath = this.extensionMetaData.realPath;
    this.extendConfig = this.extensionMetaData.extendConfig || {};
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

  toJSON(): JSONType {
    return {
      id: this.id,
      name: this.name,
      activated: this.activated,
      enabled: this.enabled,
      packageJSON: this.packageJSON,
      path: this.path,
      realPath: this.realPath,
      extraMetaData: this.extraMetadata,
      extendConfig: this.extendConfig,
    };
  }

}

import {Injectable, Optional, Autowired, Inject} from '@ali/common-di';
import { JSONType, IExtensionMetaData } from '../common';
import { getLogger, Disposable } from '@ali/ide-core-common';
import { VSCodeMetaService } from './vscode/meta';

@Injectable({multiple: true})
export class Extension extends Disposable {
  public readonly id: string;
  public readonly name: string;
  public readonly extraMetadata: JSONType = {};
  public readonly packageJSON: JSONType;
  public readonly path: string;
  public readonly realPath: string;

  private _activated: boolean;
  private _activating: Promise<void> | null = null;

  private _enabled: boolean;
  private _enabling: Promise<void> | null = null;

  private logger = getLogger();

  @Autowired(VSCodeMetaService)
  vscodeMetaService: VSCodeMetaService;

  constructor(private extensionMetaData: IExtensionMetaData) {
    super();

    this.packageJSON = extensionMetaData.packageJSON;
    this.id = `${this.packageJSON.publisher}.${this.packageJSON.name}`;
    this.name = this.packageJSON.name;
    this.extraMetadata = extensionMetaData.extraMetadata;
    this.path = extensionMetaData.path;
    this.realPath = extensionMetaData.realPath;

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
    await this.vscodeMetaService.run(this.extensionMetaData);

    this._enabling = null;
  }

  async activate() {
    if (this._activated) {
      return ;
    }
    if (this._activating) {
      return this._activating;
    }
  }

  toJSON(): JSONType {
    return {
      id: this.id,
      name: this.name,
      activated: this.activated,
      enabled: this.enabled,
      packageJSON: this.packageJSON,
      path: this.path,
      extraMetaData: this.extraMetadata,
    };
  }

}

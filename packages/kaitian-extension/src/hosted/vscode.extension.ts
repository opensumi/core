import * as vscode from 'vscode';
// import { IExtension } from '../common'
import {IExtensionHostService} from '../common';
import { ProxyIdentifier } from '@ali/ide-connection';
import { VSCodeExtensionService } from '../common/vscode';

export class VSCExtension<T> implements vscode.Extension<T> {

  readonly id: string;

  readonly extensionPath: string;

  readonly _isActive: boolean;

  readonly packageJSON: any;

  /**
   * The extension kind describes if an extension runs where the UI runs
   * or if an extension runs where the remote extension host runs. The extension kind
   * if defined in the `package.json` file of extensions but can also be refined
   * via the the `remote.extensionKind`-setting. When no remote extension host exists,
   * the value is [`ExtensionKind.UI`](#ExtensionKind.UI).
   */
  extensionKind: vscode.ExtensionKind;

  /**
   * The public API exported by this extension. It is an invalid action
   * to access this field before this extension has been activated.
   */
  private readonly _exports: T;

  private readonly _extendExportsData: any;

  private extensionService: IExtensionHostService;

  constructor(
    data,
    extensionService: IExtensionHostService,
    private mainThreadExtensionService: VSCodeExtensionService,
    exportsData?: T,
    extendExportsData?: any,
  ) {
    const { packageJSON, path, id, activated } = data;

    this.id = id;
    this.extensionPath = path;
    this.packageJSON = packageJSON;
    this.extensionKind = packageJSON.extensionKind || undefined;
    // this.isActive = activated;
    if (exportsData) {
      this._exports = exportsData;
    }

    if (extendExportsData) {
      this._extendExportsData = extendExportsData;
    }

    this.extensionService = extensionService;
  }

  get isActive(): boolean {
    return this.extensionService.isActivated(this.id);
  }

  get extendExports() {
    return this._extendExportsData || this.extensionService.getExtendExports(this.id);
  }

  get exports() {
    return this._exports || this.extensionService.getExtensionExports(this.id);
  }
  /**
   * Activates this extension and returns its public API.
   *
   * @return A promise that will resolve when this extension has been activated.
   */
  async activate(): Promise<any> {
    try {
      await this.mainThreadExtensionService.$activateExtension(this.extensionPath);
      return this.extensionService.getExtensionExports(this.id);
    } catch (e) {}
  }
}

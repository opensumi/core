import * as vscode from 'vscode';
// import { IExtension } from '../common'
import {IExtensionHostService} from '../common';

export class VSCExtension<T> implements vscode.Extension<T> {

  readonly id: string;

  readonly extensionPath: string;

  readonly isActive: boolean;

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
  readonly exports: T;

  private extensionService: IExtensionHostService;

  constructor(
    data,
    extensionService: IExtensionHostService,
    exportsData?: T,
  ) {
    const { packageJSON, path, id, activated } = data;

    this.id = id;
    this.extensionPath = path;
    this.packageJSON = packageJSON;
    this.extensionKind = packageJSON.extensionKind || undefined;
    this.isActive = activated;
    if (exportsData) {
      this.exports = exportsData;
    }

    this.extensionService = extensionService;
  }

  /**
   * Activates this extension and returns its public API.
   *
   * @return A promise that will resolve when this extension has been activated.
   */
  async activate(): Promise<any> {
    try {
      return await this.extensionService.activateExtension(this.id);
    } catch (e) {}
  }
}

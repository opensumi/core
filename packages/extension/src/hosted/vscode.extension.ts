import type vscode from 'vscode';

import { IExtensionHostService, IExtensionHost, IExtensionWorkerHost, JSONType, IExtensionProps } from '../common';
import { VSCodeExtensionService } from '../common/vscode';

export abstract class Extension<T = any, S extends IExtensionHost = any> implements vscode.Extension<T> {
  readonly id: string;

  readonly extensionPath: string;

  readonly _isActive: boolean;

  readonly packageJSON: any;

  readonly extensionKind: vscode.ExtensionKind;

  readonly extendConfig: JSONType;

  readonly extensionUri: vscode.Uri;

  private readonly _exports: T;

  constructor(
    private readonly metadata: IExtensionProps,
    protected readonly extensionService: S,
    protected readonly mainThreadExtensionService: VSCodeExtensionService,
    exportsData?: T,
  ) {
    const { packageJSON, path, id, extendConfig } = this.metadata;

    this.id = id;
    this.extensionPath = path;
    this.packageJSON = packageJSON;
    this.extensionKind = packageJSON.extensionKind || undefined;
    this.extendConfig = extendConfig || undefined;
    this.extensionUri = metadata.extensionLocation;
    if (exportsData) {
      this._exports = exportsData;
    }
  }

  get isActive(): boolean {
    return this.extensionService.isActivated(this.id);
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
      if (!this.isActive) {
        await this.mainThreadExtensionService.$activateExtension(this.extensionPath);
      }
      return this.exports;
    } catch (e) {}
  }
}

export class KTExtension<T = any> extends Extension<T, IExtensionHostService> {
  private _extendExportsData: any;

  constructor(
    metadata: IExtensionProps,
    extensionService: IExtensionHostService,
    mainThreadExtensionService: VSCodeExtensionService,
    exportsData?: T,
    extendExportsData?: any,
  ) {
    super(metadata, extensionService, mainThreadExtensionService, exportsData);
    if (extendExportsData) {
      this._extendExportsData = extendExportsData;
    }
  }

  get extendExports() {
    return this._extendExportsData || this.extensionService.getExtendExports(this.id);
  }
}

/**
 * ??? VSCExtension ????????????????????? extendExports
 * ????????? worker ?????????????????????????????? API ???????????? VS Code ?????????????????????????????? `extension.exports` ??????
 */
export class KTWorkerExtension<T = any> extends Extension<T, IExtensionWorkerHost> {
  readonly workerScriptPath: string;

  constructor(
    metadata: IExtensionProps,
    extensionService: IExtensionWorkerHost,
    mainThreadExtensionService: VSCodeExtensionService,
    exportsData?: T,
  ) {
    super(metadata, extensionService, mainThreadExtensionService, exportsData);
    if (metadata.workerScriptPath) {
      this.workerScriptPath = metadata.workerScriptPath;
    }
  }
}

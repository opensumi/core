import * as vscode from 'vscode';
import { IDisposable } from '@ali/ide-core-common';
import { IExtensionProcessService } from '../common/';

export class ExtensionActivationTimes {

  public static readonly NONE = new ExtensionActivationTimes(false, -1, -1, -1);

  public readonly startup: boolean;
  public readonly codeLoadingTime: number;
  public readonly activateCallTime: number;
  public readonly activateResolvedTime: number;

  constructor(startup: boolean, codeLoadingTime: number, activateCallTime: number, activateResolvedTime: number) {
    this.startup = startup;
    this.codeLoadingTime = codeLoadingTime;
    this.activateCallTime = activateCallTime;
    this.activateResolvedTime = activateResolvedTime;
  }
}

export interface IExtensionModule {
  activate?(ctx: vscode.ExtensionContext): Promise<any>;
  deactivate?(): void;
}

// tslint:disable-next-line: no-empty-interface
export interface IExtensionAPI {
  // TODO
}

export class ActivatedExtension {
  public readonly activationFailed: boolean;
  public readonly activationFailedError: Error | null;
  public readonly activationTimes: ExtensionActivationTimes;
  public readonly module: IExtensionModule;
  public readonly exports: IExtensionAPI | undefined;
  public readonly subscriptions: IDisposable[];

  constructor(
    activationFailed: boolean,
    activationFailedError: Error | null,
    module: IExtensionModule,
    exports: IExtensionAPI | undefined,
    subscriptions: IDisposable[],
    activationTimes?: ExtensionActivationTimes,
  ) {
    this.activationFailed = activationFailed;
    this.activationFailedError = activationFailedError;
    this.module = module;
    this.exports = exports;
    this.subscriptions = subscriptions;

    // TODO 支持 activationTimes
    if (activationTimes) {
      this.activationTimes = activationTimes;
    }
  }
}

export class ExtensionsActivator {
  private readonly activatedExtensions: Map<string, ActivatedExtension> = new Map();
  private extenstionProcessService: IExtensionProcessService;

  constructor(
    extenstionProcessService: IExtensionProcessService,
  ) {
    this.extenstionProcessService = extenstionProcessService;
  }

  has(id: string) {
     return this.activatedExtensions.has(id);
  }

  set(id: string, extension: ActivatedExtension) {
    return this.activatedExtensions.set(id, extension);
  }

  get(id: string) {
    return this.activatedExtensions.get(id);
  }

  delete(id: string) {
    return this.activatedExtensions.delete(id);
  }
}

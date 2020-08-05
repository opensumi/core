import * as vscode from 'vscode';
import { IDisposable } from '@ali/ide-core-common';
// import { IExtensionProcessService } from '../common/';

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

// tslint:disable-next-line: no-empty-interface
export interface IExtendExportAPI {
  //
}

export class ActivatedExtension {
  constructor(
    public readonly activationFailed: boolean,
    public readonly activationFailedError: Error | null,
    public readonly module: IExtensionModule,
    public readonly exports: IExtensionAPI | undefined,
    public readonly subscriptions: IDisposable[],
    public readonly activationTimes?: ExtensionActivationTimes,
    public readonly extendExports?: IExtendExportAPI,
    public readonly extendModule?: IExtensionModule,
  ) {
    this.activationFailedError = activationFailedError;
    this.module = module;
    this.exports = exports;
    this.subscriptions = subscriptions;

    // TODO 支持 activationTimes 了吗?
    if (activationTimes) {
      this.activationTimes = activationTimes;
    }
  }
}

export class ExtensionsActivator {
  private readonly activatedExtensions: Map<string, ActivatedExtension> = new Map();

  constructor(
    private logger: any = console,
  ) {
  }

  has(id: string) {
     return this.activatedExtensions.has(id);
  }

  set(id: string, extension: ActivatedExtension) {
    return this.activatedExtensions.set(id, extension);
  }

  get(id: string): ActivatedExtension | undefined {
    return this.activatedExtensions.get(id);
  }

  delete(id: string) {
    return this.activatedExtensions.delete(id);
  }

  private doDeactivate(extensionModule) {
    try {
      const promiseLike = (extensionModule as Required<IExtensionModule>).deactivate();
      return Promise.resolve(promiseLike);
    } catch (err) {
      this.logger.error(`
        [Extension-Host] deactivate extension module error ${err.message} \n\n
        Stack: ${err.stack && err.stack}
      `);
      return Promise.resolve(err);
    }
  }

  deactivate() {
    const deactivateTasks: Promise<void>[] = [];
    this.activatedExtensions.forEach((ext) => {
      const extModule = ext.module;
      if (extModule && extModule.deactivate && typeof extModule.deactivate === 'function') {
        deactivateTasks.push(this.doDeactivate(extModule));
      }

      const extendModule = ext.extendModule;
      if (extendModule && extendModule.deactivate && typeof extendModule.deactivate === 'function') {
        deactivateTasks.push(this.doDeactivate(extendModule));
      }

      ext.subscriptions.forEach((disposable) => {
        try {
          disposable.dispose();
        } catch (e) {
          this.logger.log('extension deactivated error');
          this.logger.warn(e);
        }
      });
    });
    return Promise.all(deactivateTasks);
  }
}

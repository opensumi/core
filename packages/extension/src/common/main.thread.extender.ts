import { Injectable } from '@opensumi/di';
import { IRPCProtocol, ProxyIdentifier } from '@opensumi/ide-connection';
import { Disposable, IDisposable } from '@opensumi/ide-core-common';

export interface IMainThreadExtender<T = any> {
  identifier: ProxyIdentifier<T>;
  serviceClass: new (rpcProtocol: IRPCProtocol) => T;
}

export const IMainThreadExtenderService = Symbol('IMainThreadExtenderService');
export interface IMainThreadExtenderService<T = any> {
  registerMainThreadExtender(extender: IMainThreadExtender<T>): IDisposable;
  getMainThreadExtenders(): IMainThreadExtender<T>[];
}

export const MainThreadExtenderContribution = Symbol('MainThreadExtenderContribution');

export interface MainThreadExtenderContribution {
  registerMainThreadExtender(registry: IMainThreadExtenderService): void;
}

@Injectable()
export class MainThreadExtenderService<T> implements IMainThreadExtenderService<T> {
  private readonly registry: IMainThreadExtender<T>[] = [];

  registerMainThreadExtender(extender: IMainThreadExtender) {
    this.registry.push(extender);
    return Disposable.create(() => {
      const index = this.registry.indexOf(extender);
      if (index !== -1) {
        this.registry.splice(index, 1);
      }
    });
  }

  getMainThreadExtenders() {
    return this.registry;
  }
}

import { Injectable, Injector, Autowired } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection/lib/common/rpcProtocol';
import { Disposable, IDisposable, ILogger } from '@opensumi/ide-core-common';

import { IExtension } from '..';

export interface IBrowserRequireInterceptorArgs {
  injector: Injector;
  extension: IExtension;
  rpcProtocol?: IRPCProtocol;
}

export interface IRequireInterceptor<T> {
  moduleName: string;
  load(request: T): any;
}

export const IRequireInterceptorService = Symbol('IRequireInterceptorService');
export interface IRequireInterceptorService<T = any> {
  registerRequireInterceptor(interceptor: IRequireInterceptor<T>): IDisposable;
  getRequireInterceptor(moduleName: string): IRequireInterceptor<T> | undefined;
}

export const RequireInterceptorContribution = Symbol('RequireInterceptorContribution');

export interface RequireInterceptorContribution {
  registerRequireInterceptor(registry: IRequireInterceptorService): void;
}

@Injectable()
export class RequireInterceptorService<T> implements IRequireInterceptorService<T> {
  @Autowired(ILogger)
  private readonly logger: ILogger;

  private readonly registry = new Map<string, IRequireInterceptor<T>>();

  registerRequireInterceptor(interceptor: IRequireInterceptor<T>) {
    if (this.registry.has(interceptor.moduleName)) {
      this.logger.warn(`module ${interceptor.moduleName} already register`);
      return Disposable.NULL;
    }
    this.registry.set(interceptor.moduleName, interceptor);
    return Disposable.create(() => {
      this.registry.delete(interceptor.moduleName);
    });
  }

  getRequireInterceptor(moduleName: string) {
    return this.registry.get(moduleName);
  }
}

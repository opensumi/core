import { ConstructorOf, CreatorStatus, Injector, InstanceOpts, Token, TokenResult } from '@opensumi/di';
import { MockLoggerManageClient, MockLoggerService } from '@opensumi/ide-core-browser/__mocks__/logger';
import { CommandRegistry, ILogServiceManager, ILoggerManagerClient, getDebugLogger } from '@opensumi/ide-core-common';
import { INodeLogger, NodeModule, ServerApp } from '@opensumi/ide-core-node';

export class MockInjector extends Injector {
  private mockMap = new Map<Token, [any, any][]>();

  mock<T extends Token, K extends keyof TokenResult<T>>(token: T, method: K, value: TokenResult<T>[K]) {
    if (this.hasCreated(token)) {
      const instance = this.get(token);
      Object.defineProperty(instance, method, {
        get: () => value,
        set: (v) => {
          value = v;
        },
        enumerable: true,
        configurable: true,
      });
    } else {
      const map: [any, any][] = this.mockMap.get(token) || [];
      map.push([method, value]);
      this.mockMap.set(token, map);
    }
  }

  get<T extends ConstructorOf<any>>(token: T, args?: ConstructorParameters<T>, opts?: InstanceOpts): TokenResult<T>;
  get<T extends Token>(token: T, opts?: InstanceOpts): TokenResult<T>;
  get<T>(token: Token, opts?: InstanceOpts): T;
  get(arg1: any, arg2?: any, arg3?: any) {
    const instance = super.get(arg1, arg2, arg3);
    const mockDefs = this.mockMap.get(arg1);
    if (mockDefs) {
      for (const mockDef of mockDefs) {
        const method = mockDef[0];
        let value = mockDef[1];
        Object.defineProperty(instance, method, {
          get: () => value,
          set: (v) => {
            value = v;
          },
          enumerable: true,
          configurable: true,
        });
        this.mockMap.delete(arg1);
      }
    }
    return instance;
  }

  private hasCreated(token: Token) {
    const creator = this.creatorMap.get(token);
    return creator && creator.status === CreatorStatus.done;
  }

  public mockCommand(commandId: string, fn?) {
    const registry = this.get(CommandRegistry) as CommandRegistry;
    if (registry.getCommand(commandId)) {
      registry.unregisterCommand(commandId);
    }
    registry.registerCommand(
      {
        id: commandId,
      },
      {
        execute: (...args) => {
          if (typeof fn === 'function') {
            fn(...args);
          } else if (typeof fn !== 'undefined') {
            return fn;
          }
        },
      },
    );
  }

  public mockService(token: Token, proxyObj: any = {}) {
    this.addProviders({
      token,
      useValue: mockService(proxyObj),
      override: true,
    });
  }
}

export function mockService<T = any>(target: Partial<T>): any {
  return new Proxy(target, {
    get: (t, p) => {
      if (p === 'hasOwnProperty') {
        return t[p];
      }
      // eslint-disable-next-line no-prototype-builtins
      if (!t.hasOwnProperty(p)) {
        t[p] = jest.fn();
      }
      return t[p];
    },
  });
}

export function getNodeMockInjector() {
  const injector = new MockInjector();
  injector.addProviders(
    {
      token: ILoggerManagerClient,
      useClass: MockLoggerManageClient,
    },
    {
      token: ILogServiceManager,
      useClass: MockLoggerService,
    },
    {
      token: INodeLogger,
      useValue: getDebugLogger(),
    },
  );
  return injector;
}

export function createNodeInjector(modules: Array<ConstructorOf<NodeModule>>, inj?: Injector): MockInjector {
  const injector = inj || getNodeMockInjector();
  const app = new ServerApp({ modules, injector } as any);

  return app.injector as MockInjector;
}

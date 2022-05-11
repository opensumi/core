import { Injector, Token, TokenResult, InstanceOpts, ConstructorOf, CreatorStatus, Provider } from '@opensumi/di';
import { CommandRegistry } from '@opensumi/ide-core-common';

export class MockInjector extends Injector {
  // tslint:disable-next-line
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
    const mockDefinations = this.mockMap.get(arg1);
    if (mockDefinations) {
      for (const mockDefination of mockDefinations) {
        const method = mockDefination[0];
        let value = mockDefination[1];
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

  public mockCommand(commandId, fn?) {
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

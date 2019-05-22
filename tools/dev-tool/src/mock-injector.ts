import { Injector, Token, TokenResult, InstanceOpts, ConstructorOf, CreatorStatus } from '@ali/common-di';
import mm from '@ali/mm';

afterEach(() => {
  mm.restore();
});

export class MockInjector extends Injector {
  // tslint:disable-next-line
  private mockMap = new Map<Token, [any, any]>();

  mock<T extends Token, K extends keyof TokenResult<T>>(token: T, method: K, value: TokenResult<T>[K]) {
    if (this.hasCreated(token)) {
      const instance = this.get(token);
      mm(instance, method as any, value);
    } else {
      this.mockMap.set(token, [method, value]);
    }
  }

  get<T extends ConstructorOf<any>>(token: T, args?: ConstructorParameters<T>, opts?: InstanceOpts): TokenResult<T>;
  get<T extends Token>(token: T, opts?: InstanceOpts): TokenResult<T>;
  get(arg1: any, arg2?: any, arg3?: any) {
    const instance = super.get(arg1, arg2, arg3);

    const mockDefination = this.mockMap.get(arg1);
    if (mockDefination) {
      const method = mockDefination[0];
      const value = mockDefination[1];
      mm(instance, method, value);
    }

    return instance;
  }

  private hasCreated(token: Token) {
    const creator = this.creatorMap.get(token);
    return creator && creator.status === CreatorStatus.done;
  }
}

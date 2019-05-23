import { StatusBarModule } from '../../src/browser';
import { Injector } from '@ali/common-di';
import { createBrowserInjector } from '@ali/ide-dev-tool/src/injector-helper';

describe('template test', () => {
  let injector: Injector;

  beforeEach(() => {
    injector = createBrowserInjector([StatusBarModule]);
  });

  it('StatusBarModule', () => {
    const instance = injector.get(StatusBarModule);
    expect(instance.providers).toEqual([]);
  });
});

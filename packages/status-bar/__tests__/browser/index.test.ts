import { StatusBarModule } from '../../src/browser';
import { Injector } from '@ali/common-di';
import { createBrowserInjector } from '@ali/ide-dev-tool/src/injector-helper';
import { StatusBar } from '@ali/ide-status-bar/lib/browser/status-bar.service';

describe('template test', () => {
  let injector: Injector;

  beforeEach(() => {
    injector = createBrowserInjector([StatusBarModule]);
  });

  it('StatusBarModule', () => {
    const instance = injector.get(StatusBarModule);
    expect(instance.providers).toHaveLength(1);
  });
});

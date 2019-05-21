import { TemplateUpperNameModule } from '../../src/browser';
import { Injector } from '@ali/common-di';
import { createBrowserInjector } from '@ali/ide-dev-tool/src/injector-helper';

describe('template test', () => {
  let injector: Injector;

  beforeEach(() => {
    injector = createBrowserInjector([TemplateUpperNameModule]);
  });

  it('TemplateUpperNameModule', () => {
    const instance = injector.get(TemplateUpperNameModule);
    expect(instance.providers).toEqual([]);
  });
});

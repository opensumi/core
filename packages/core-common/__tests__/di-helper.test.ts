import { Injectable, Injector } from '@opensumi/di';

import { Domain } from '../src/di-helper';

describe('di-helper', () => {
  const domain = Symbol('domain');

  @Domain(domain)
  @Injectable()
  class A {}

  it('能够通过 domain 找到对象实例', () => {
    const injector = new Injector([A]);
    const instance = injector.getFromDomain(domain)[0];
    expect(instance).toBeInstanceOf(A);
  });
});

import { Injectable, Injector } from '@ali/common-di';
import { getDomainConstructors, Domain } from '../src/di-helper';

describe('di-helper', () => {
  const domain = Symbol('domain');

  @Domain(domain)
  @Injectable()
  class A {}

  it('能够通过 domain 找到对象实例', () => {
    const injector = new Injector();
    const tokens = getDomainConstructors(domain);
    injector.addProviders(...tokens);
    const instance = injector.getFromDomain(domain)[0];
    expect(instance).toBeInstanceOf(A);
  });
});

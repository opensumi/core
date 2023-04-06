import { markInjectable, getInjectableOpts, Domain } from '@opensumi/di';

import { ConstructorOf } from '../declare';

/**
 * 修饰一个 Class 是某个特定的 DI 分组的装饰器
 * @param domains
 */
export function Domain(...domains: Domain[]) {
  return (target: ConstructorOf<any>) => {
    const opts = getInjectableOpts(target) || {};
    opts.domain = domains;
    markInjectable(target, opts);
  };
}

const domainMap = new Map<Domain, ConstructorOf<any>>();

/**
 * 带全局记录的 Domain 装饰器
 * @param domain
 */
export function EffectDomain(domain: Domain) {
  return (target: ConstructorOf<any>) => {
    const opts = getInjectableOpts(target) || {};
    opts.domain = domain;
    markInjectable(target, opts);

    const tmp = domainMap.get(domain);
    if (!tmp) {
      domainMap.set(domain, target);
    }
  };
}

export function getDomainConstructors(...domains: Domain[]) {
  const constructorSet = new Set<ConstructorOf<any>>();
  for (const domain of domains) {
    const constructor = domainMap.get(domain);
    if (constructor) {
      constructorSet.add(constructor);
    } else {
      // eslint-disable-next-line no-console
      console.error(`Unable to retrieve the Constructor for ${String(domain)}`);
    }
  }
  return Array.from(constructorSet);
}

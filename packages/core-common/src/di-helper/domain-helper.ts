import { markInjectable, getInjectableOpts, Domain } from '@ali/common-di';
import { ConstructorOf } from '../declare';

const domainMap = new Map<Domain, Array<ConstructorOf<any>>>();

/**
 * 修饰一个 Class 是某个特定的 DI 分组的装饰器
 * @param domains 
 */
export function Domain(...domains: Domain[]) {
  return (target: ConstructorOf<any>) => {
    const opts = getInjectableOpts(target) || {};
    opts.domain = domains;
    markInjectable(target, opts);

    for (const domain of domains) {
      const arr = domainMap.get(domain) || [];
      if (!arr.includes(target)) {
        arr.push(target);
      }
      domainMap.set(domain, arr);
    }
  }
}

export function getDomainConstructors(...domains: Domain[]) {
  const constructorSet = new Set<ConstructorOf<any>>();
  for (const domain of domains) {
    const arr = domainMap.get(domain) || [];
    arr.forEach((item) => constructorSet.add(item));
  }
  return Array.from(constructorSet);
}

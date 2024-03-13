import { Domain, getInjectableOpts, markInjectable } from '@opensumi/di';

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

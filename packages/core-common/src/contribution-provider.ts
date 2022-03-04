import { Injector, Domain, ConstructorOf } from '@opensumi/di';

export const ContributionProvider = Symbol('ContributionProvider');

export interface ContributionProvider<T extends object> {
  getContributions(): T[];
  addContribution(...contributionsCls: ConstructorOf<any>[]): void;
  reload(): T[];
}

export class BaseContributionProvider<T extends object> implements ContributionProvider<T> {
  protected services: T[] | undefined;

  constructor(protected readonly domain: Domain, protected readonly injector: Injector) {}

  addContribution(...contributionsCls: ConstructorOf<T>[]): void {
    for (const contributionCls of contributionsCls) {
      this.injector.addProviders(contributionCls);
      if (this.services) {
        this.services.push(this.injector.get(contributionCls));
      }
    }
  }

  getContributions(): T[] {
    return this.injector.getFromDomain(this.domain);
  }

  reload(): T[] {
    this.services = this.injector.getFromDomain(this.domain);
    return this.services;
  }
}

/**
 * 使用工厂函数创建 ContributionProvider
 * @param injector 全局唯一的 injector，用来获取当前 Domain 的 Contribution、并注册 ContributionProvider
 * @param domain 用来区分 Contribution 的标识，也是 ContributionProvider 的 Token
 */
export function createContributionProvider(injector: Injector, domain: Domain) {
  const contributionProvider = new BaseContributionProvider(domain, injector);

  injector.addProviders({
    token: domain,
    useValue: contributionProvider,
  });
}

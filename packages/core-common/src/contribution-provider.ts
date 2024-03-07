import { Autowired, ConstructorOf, Domain, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';

import { ILogger } from './log';

export const ContributionProvider = Symbol('ContributionProvider');

export interface ContributionProvider<T extends object> {
  getContributions(): T[];
  addContribution(...contributionsCls: ConstructorOf<any>[]): void;
  reload(): T[];

  run<K extends keyof T>(method: K, ...args: T[K] extends (...args: any[]) => any ? Parameters<T[K]> : any[]): void;
}

@Injectable({ multiple: true })
export class BaseContributionProvider<T extends object> implements ContributionProvider<T> {
  @Autowired(ILogger)
  logger: ILogger;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  protected services: T[] | undefined;

  constructor(protected readonly domain: Domain) {}

  addContribution(...contributionsCls: ConstructorOf<T>[]): void {
    for (const contributionCls of contributionsCls) {
      this.injector.addProviders(contributionCls);
      if (this.services) {
        this.services.push(this.injector.get(contributionCls));
      }
    }
  }

  run(method: keyof T, ...args: any[]) {
    for (const contribution of this.getContributions()) {
      if (contribution[method]) {
        this.logger.log(`Run method ${String(method)} of ${contribution.constructor.name}`);
        (contribution[method] as any)(...args);
        this.logger.log(`Run method ${String(method)} of ${contribution.constructor.name} done`);
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
  const contributionProvider = injector.get(BaseContributionProvider, [domain]);

  injector.addProviders({
    token: domain,
    useValue: contributionProvider,
  });
}

import { ConstructorOf, Domain, Injector } from '@opensumi/di';

import { getDebugLogger } from './log';
import { IPerformance } from './types';
import { MaybePromise } from './utils';

export const ContributionProvider = Symbol('ContributionProvider');

export interface ContributionProvider<T extends object> {
  getContributions(): T[];
  addContribution(...contributionsCls: ConstructorOf<any>[]): void;
  reload(): T[];

  run<K extends keyof T>(
    method: K,
    ...args: T[K] extends (...args: any[]) => any ? Parameters<T[K]> : any[]
  ): MaybePromise<void>;
}

export class BaseContributionProvider<T extends object> implements ContributionProvider<T> {
  _performance: IPerformance;

  private logger = getDebugLogger();
  protected services: T[] | undefined;

  constructor(protected readonly domain: Domain, protected readonly injector: Injector) {}

  get performance() {
    if (!this._performance) {
      this._performance = this.injector.get(IPerformance);
    }
    return this._performance;
  }

  addContribution(...contributionsCls: ConstructorOf<T>[]): void {
    for (const contributionCls of contributionsCls) {
      this.injector.addProviders(contributionCls);
      if (this.services) {
        this.services.push(this.injector.get(contributionCls));
      }
    }
  }

  run(method: keyof T, ...args: any[]): MaybePromise<any> {
    const promises = [] as Promise<any>[];
    for (const contribution of this.getContributions()) {
      promises.push(this.contributionPhaseRunner(contribution, method, args));
    }
    if (promises.length > 0) {
      return Promise.all(promises);
    }
  }

  private async contributionPhaseRunner(contribution: T, phaseName: keyof T, args: any[]) {
    const phase = contribution[phaseName];
    if (typeof phase === 'function') {
      try {
        const uid = contribution.constructor.name + '.' + String(phaseName);
        return await this.performance.measure(uid, () => phase.apply(contribution, args));
      } catch (error) {
        this.logger.error(`Could not run contribution#${String(phaseName)}`, error);
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

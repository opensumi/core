/********************************************************************************
 * Copyright (C) 2017 TypeFox and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import { Injector, Token, Domain } from '@ali/common-di';

export const ContributionProvider = Symbol('ContributionProvider');

export interface ContributionProvider<T extends object> {
  getContributions(): T[]
}

export class BaseContributionProvider<T extends object> implements ContributionProvider<T> {

  protected services: T[] | undefined;

  constructor(
    protected readonly domain: Domain,
    protected readonly injector: Injector
  ) { }

  getContributions(): T[] {
    if (this.services === undefined) {
      // 从 Injector 里获取相同类型的 Contribution
      this.services = this.injector.getFromDomain(this.domain);
    }
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

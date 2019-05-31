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

import { Injector, Injectable, Domain, INJECTOR_TOKEN, Autowired, Optinal } from '@ali/common-di';

export const ContributionProvider = Symbol('ContributionProvider');

export interface ContributionProvider<T extends object> {
    getContributions(): T[]
}

@Injectable({
  multiple: true
})
export class BaseContributionProvider<T extends object> implements ContributionProvider<T> {
    @Autowired(INJECTOR_TOKEN)
    protected readonly injector: Injector;
    
    protected services: T[] | undefined;

    constructor(
        @Optinal(Symbol()) protected readonly domain: Domain
    ) { }

    getContributions(): T[] {
        if (this.services === undefined) {
            // 从 Injector 里获取相同类型的 Contribution
            this.services = this.injector.getFromDomain(this.domain);
        }
        return this.services;
    }
}




/********************************************************************************
 * Copyright (C) 2018 TypeFox and others.
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

import { Injectable, Autowired } from '@ali/common-di';
import { Deferred, IEventBus, BasicEvent } from '@ali/ide-core-common';

// 状态本身不带有顺序，以 `reachedState` 时生成 promise，以赋值时 resolve 掉 promise
export type ClientAppState =
  'init'
  | 'client_connected'
  | 'started_contributions'
  | 'ready'
  | 'closing_window';

export class ClientAppStateEvent extends BasicEvent<ClientAppState> { }

@Injectable()
export class ClientAppStateService {

  private _state: ClientAppState = 'init';

  protected deferred: { [state: string]: Deferred<void> } = {};

  @Autowired(IEventBus)
  private eventBus: IEventBus;

  get state(): ClientAppState {
    return this._state;
  }

  set state(state: ClientAppState) {
    if (state !== this._state) {
      this.deferred[this._state] = new Deferred();
      this._state = state;
      if (this.deferred[state] === undefined) {
        this.deferred[state] = new Deferred();
      }
      this.deferred[state].resolve();
      this.eventBus.fire(new ClientAppStateEvent(state));
    }
  }

  reachedState(state: ClientAppState): Promise<void> {
    if (this.deferred[state] === undefined) {
      this.deferred[state] = new Deferred();
    }
    return this.deferred[state].promise;
  }

  reachedAnyState(...states: ClientAppState[]): Promise<void> {
    return Promise.race(states.map((s) => this.reachedState(s)));
  }

}

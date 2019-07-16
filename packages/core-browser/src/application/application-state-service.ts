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

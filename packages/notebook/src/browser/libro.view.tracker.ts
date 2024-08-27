import { action, makeObservable, observable } from 'mobx';

import { Injectable } from '@opensumi/di';

@Injectable({ multiple: true })
export class LibroTracker {
  constructor() {
    makeObservable(this);
  }

  @observable
  refreshTimer: number | undefined = undefined;

  @action
  refresh(refreshTimer: number | undefined) {
    this.refreshTimer = refreshTimer;
  }
}

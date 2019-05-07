import { Injectable } from '@ali/common-di';
import { Disposable } from '@ali/ide-core';
import { interval } from 'rxjs';
import { observable } from 'mobx';
import { take } from 'rxjs/operators';

@Injectable()
export default class TimerService extends Disposable {
  @observable.ref
  count = 0;

  constructor() {
    super();

    const sub = interval(1000).pipe(take(2)).subscribe(() => {
      this.count++;
    });
    this.disposations.add(() => sub.unsubscribe());
  }
}

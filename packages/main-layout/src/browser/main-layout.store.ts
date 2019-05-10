import { observable } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import { Disposable } from '@ali/ide-core';
import { interval } from 'rxjs';
import { take } from 'rxjs/operators';

@Injectable({ mutiple: true })
export default class MainLayoutStore extends Disposable {
  @observable.ref
  count = 0;

  constructor(
  ) {
    super();

  }
}

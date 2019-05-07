import { observable } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import { Disposable } from '@ali/ide-core';
import TimerService from './timer.service';
import { interval } from 'rxjs';
import { take } from 'rxjs/operators';
import FileTreeService from './file-tree.service';

@Injectable({ mutiple: true })
export default class FileTreeStore extends Disposable {
  @observable.ref
  count = 0;

  @Autowired()
  timer!: TimerService;

  fileTreeService: FileTreeService;

  constructor(
    fileTreeService: FileTreeService,
  ) {
    super();

    this.fileTreeService = fileTreeService;
    const sub = interval(3000).pipe(take(2)).subscribe(() => {
      this.count++;
      this.count++;
    });
    this.disposations.add(() => sub.unsubscribe());
  }
}

import { Injectable } from '@ali/common-di';
import { Emitter } from '@ali/ide-core-common';

@Injectable()
export class SearchBrowserService {

  protected resultEmitter: Emitter<any> = new Emitter();
  protected focusEmitter: Emitter<void> = new Emitter();

  onSearchResult(data) {
    this.resultEmitter.fire(data);
  }

  focus() {
    this.focusEmitter.fire();
  }

  get onFocus() {
    return this.focusEmitter.event;
  }

  get onResult() {
    return this.resultEmitter.event;
  }
}

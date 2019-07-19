import { Injectable } from '@ali/common-di';
import { Emitter } from '@ali/ide-core-common';
import {
  ContentSearchResult,
} from '../common';

@Injectable()
export class SearchBrowserService {

  protected resultEmitter: Emitter<any> = new Emitter();

  onSearchResult(data) {
    this.resultEmitter.fire(data);
  }

  get onResult() {
    return this.resultEmitter.event;
  }
}

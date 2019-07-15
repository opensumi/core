import { Injectable } from '@ali/common-di';
import { Emitter } from '@ali/ide-core-common';
import {
  ContentSearchResult,
} from '../common';

@Injectable()
export class SearchBrowserService {

  protected resultEmitter: Emitter<{ data: ContentSearchResult[], id: number }> = new Emitter();

  onSearchResult(data: ContentSearchResult[], id: number) {
    this.resultEmitter.fire({
      data,
      id,
    });
  }

  get onResult() {
    return this.resultEmitter.event;
  }
}

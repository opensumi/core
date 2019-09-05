import { Injectable } from '@ali/common-di';
import { Emitter } from '@ali/ide-core-common';
import { ContentSearchResult, SEARCH_STATE } from '../common';

@Injectable()
export class SearchBrowserService {

  protected resultEmitter: Emitter<any> = new Emitter();
  protected focusEmitter: Emitter<void> = new Emitter();

  protected refreshEmitterDisposer;
  protected refreshEmitter: Emitter<void> = new Emitter();
  protected cleanEmitterDisposer;
  protected cleanEmitter: Emitter<void> = new Emitter();
  protected foldEmitterDisposer;
  protected foldEmitter: Emitter<void> = new Emitter();

  protected searchValue: string;
  protected searchResults: Map<string, ContentSearchResult[]> | null;
  protected searchState: SEARCH_STATE;

  onSearchResult(data) {
    this.resultEmitter.fire(data);
  }

  setSearchInfo(options: {
    searchValue?: string,
    searchResults?: Map<string, ContentSearchResult[]> | null,
    searchState?: SEARCH_STATE,
  }) {
    if (options.searchResults) {
      this.searchResults = options.searchResults;
    }
    if (options.searchState) {
      this.searchState = options.searchState;
    }
    if (options.searchValue) {
      this.searchValue = options.searchValue;
    }
  }

  focus() {
    this.focusEmitter.fire();
  }

  refresh() {
    this.refreshEmitter.fire();
  }

  refreshIsEnable() {
    return this.searchState !== SEARCH_STATE.doing;
  }

  clean() {
    this.cleanEmitter.fire();
  }

  cleanIsEnable() {
    return !!(this.searchValue || this.searchResults && this.searchResults.size > 0);
  }

  fold() {
    this.foldEmitter.fire();
  }

  foldIsEnable() {
    return !!(this.searchValue || this.searchResults && this.searchResults.size > 0);
  }

  get onResult() {
    return this.resultEmitter.event;
  }

  get onFocus() {
    return this.focusEmitter.event;
  }

  get onRefresh() {
    return (callback) => {
      if (this.refreshEmitterDisposer && this.refreshEmitterDisposer.dispose) {
        this.refreshEmitterDisposer.dispose();
      }
      this.refreshEmitterDisposer = this.refreshEmitter.event(callback);
    };
  }

  get onClean() {
    return (callback) => {
      if (this.cleanEmitterDisposer && this.cleanEmitterDisposer.dispose) {
        this.cleanEmitterDisposer.dispose();
      }
      this.cleanEmitterDisposer = this.cleanEmitter.event(callback);
    };
  }

  get onFold() {
    return (callback) => {
      if (this.foldEmitterDisposer && this.foldEmitterDisposer.dispose) {
        this.foldEmitterDisposer.dispose();
      }
      this.foldEmitterDisposer = this.foldEmitter.event(callback);
    };
  }
}

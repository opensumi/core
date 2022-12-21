import { Injectable } from '@opensumi/di';
import { Disposable } from '@opensumi/ide-core-common';

import { ContentSearchOptions, IContentSearchServer } from '../src/common/content-search';

@Injectable()
export class MockContentSearchServer extends Disposable implements IContentSearchServer {
  catchSearchValue: string;
  catchSearchRootDirs: string[];
  catchSearchOptions: ContentSearchOptions;
  catchSearchId: number;

  replaceValue = '';

  async search(searchId: number, value: string, rootDirs: string[], searchOptions: ContentSearchOptions) {
    this.catchSearchValue = value;
    this.catchSearchRootDirs = rootDirs;
    this.catchSearchOptions = searchOptions;
    this.catchSearchId = searchId;
    return searchId;
  }

  async cancel() {}
}

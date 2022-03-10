import { Injectable } from '@opensumi/di';
import { URI } from '@opensumi/ide-core-browser';

import { IDocPersistentCacheProvider, IDocStatus } from '../../common/doc-cache';

/**
 * 一个空的，什么都不做的缓存对象，提供一个空的缓存对象实现
 */
@Injectable()
export class EmptyDocCacheImpl implements IDocPersistentCacheProvider {
  hasCache(_uri: URI) {
    return false;
  }

  isFlushed() {
    return true;
  }

  getCache(_uri: URI) {
    return null;
  }

  persistCache(_uri: URI, _status: IDocStatus) {
    // nothing
  }
}

import { Injectable, Autowired } from '@opensumi/di';
import { URI } from '@opensumi/ide-core-common';
import { IWorkspaceStorageService } from '@opensumi/ide-workspace';

import { IDocPersistentCacheProvider, IDocStatus, IDocCache, parseCacheValueFrom } from '../../common/doc-cache';

/**
 * 使用 LocalStorage 实现的文档缓存对象
 */
@Injectable()
export class LocalStorageDocCacheImpl implements IDocPersistentCacheProvider {
  @Autowired(IWorkspaceStorageService)
  private storageService: IWorkspaceStorageService;

  hasCache(_uri: URI) {
    return true;
  }

  /**
   * LocalStorage 的存储都是瞬间完成的，始终返回 true
   */
  isFlushed() {
    return true;
  }

  /**
   * 从 LocalStorage 获取缓存数据，
   * 因为底层对象设计是异步的，所以这里也是异步的，实际上是立即返回的
   * @param uri
   */
  async getCache(uri: URI) {
    const key = this.parseKeyFrom(uri);
    const result = await this.storageService.getData<IDocCache>(key);
    return result || null;
  }

  /**
   * 持久化缓存对象到 LocalStorage 中
   * @param uri
   * @param status
   */
  persistCache(uri: URI, status: IDocStatus) {
    const key = this.parseKeyFrom(uri);
    const cache = this.parseCacheFrom(uri, status);
    this.storageService.setData(key, cache);
  }

  /**
   * 从文档状态解析缓存对象
   * @param status
   */
  private parseCacheFrom(uri: URI, status: IDocStatus): IDocCache | undefined {
    if (!status.dirty || !status.changeMatrix.length) {
      return undefined;
    }

    return {
      path: uri.path.toString(),
      startMD5: status.startMD5,
      changeMatrix: status.changeMatrix.map((changes) => changes.map((change) => parseCacheValueFrom(change))),
    };
  }

  private parseKeyFrom(uri: URI): string {
    return `LocalStorageDocCacheImpl_${uri.toString()}`;
  }
}

import { Autowired, Injectable } from '@opensumi/di';
import { IAICompletionOption, IAICompletionResultModel, StaleLRUMap } from '@opensumi/ide-core-browser';
import { IHashCalculateService } from '@opensumi/ide-core-common/lib/hash-calculate/hash-calculate';

const isCacheEnable = () => true;

/**
 * 缓存服务
 * 1. 过期时间为 1min
 * 2. 用 prompt 的 hash 值作为 key
 */
@Injectable()
export class PromptCache {
  @Autowired(IHashCalculateService)
  private hashCalculateService: IHashCalculateService;

  private cacheMap = new StaleLRUMap<string, IAICompletionResultModel & { relationId: string }>(15, 10, 60 * 1000);

  protected calculateCacheKey(requestBean: IAICompletionOption) {
    const content = requestBean.prompt + (requestBean.suffix || '');
    return this.hashCalculateService.calculate(content);
  }

  getCache(requestBean: IAICompletionOption) {
    if (!isCacheEnable()) {
      return null;
    }
    const hash = this.calculateCacheKey(requestBean);
    if (hash) {
      return this.cacheMap.get(hash) || null;
    }
    return null;
  }

  setCache(bean: IAICompletionOption, res: any) {
    if (!isCacheEnable()) {
      return false;
    }
    if (!res) {
      return false;
    }

    const hash = this.calculateCacheKey(bean);
    if (hash) {
      this.cacheMap.set(hash, res);
      return true;
    }
    return false;
  }
}

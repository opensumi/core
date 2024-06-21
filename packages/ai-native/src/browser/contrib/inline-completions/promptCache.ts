import { Autowired, Injectable } from '@opensumi/di';
import { IAICompletionResultModel, StaleLRUMap } from '@opensumi/ide-core-browser';
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

  getCache(prompt: string) {
    if (!isCacheEnable()) {
      return null;
    }
    const hash = this.hashCalculateService.calculate(prompt);
    if (hash) {
      return this.cacheMap.get(hash) || null;
    }
    return null;
  }

  setCache(prompt: string, res: any) {
    if (!isCacheEnable()) {
      return false;
    }
    if (!res) {
      return false;
    }

    const hash = this.hashCalculateService.calculate(prompt);
    if (hash) {
      this.cacheMap.set(hash, res);
      return true;
    }
    return false;
  }
}

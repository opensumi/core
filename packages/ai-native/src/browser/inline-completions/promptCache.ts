import { Autowired, Injectable } from '@opensumi/di';
import { IHashCalculateService } from '@opensumi/ide-core-common/lib/hash-calculate/hash-calculate';

const isCacheEnable = () => true;

/**
 * 缓存服务
 * 1. 过期时间为 1min
 * 2. 用 prompt 的 hash 值作为 key
 * 3. 缓存数量为 10
 */

@Injectable()
export class PromptCache {
  @Autowired(IHashCalculateService)
  private hashCalculateService: IHashCalculateService;

  private expireTime: number;
  private cacheMap: Map<string, any>;
  private size: number;
  constructor() {
    this.expireTime = 60 * 1000;
    this.cacheMap = new Map();
    this.size = 10;
  }
  getCache(prompt: string) {
    if (!isCacheEnable()) {
      return null;
    }
    const hash = this.hashCalculateService.calculate(prompt);
    if (hash) {
      const res = this.cacheMap.get(hash) || null;
      if (!res) {
        return null;
      }
      const curTime = Date.now();
      if (curTime - res.timestamp > this.expireTime) {
        this.cacheMap.delete(hash);
        return null;
      }
      return res;
    }
    return null;
  }

  setCache(prompt: string, res: any) {
    if (!isCacheEnable()) {
      return false;
    }
    const hash = this.hashCalculateService.calculate(prompt);
    if (res === null) {
      return false;
    }
    if (hash) {
      const timestamp = Date.now();
      res.timestamp = timestamp;
      this.cacheMap.set(hash, res);
      if (this.cacheMap.size > this.size) {
        const entries = this.cacheMap.entries();
        const firstEntry = entries.next().value;
        if (firstEntry) {
          this.cacheMap.delete(firstEntry[0]);
        }
      }
      return true;
    }
    return false;
  }
}

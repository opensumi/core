import { createHash } from 'crypto';

function hashString(str: string) {
  const hash = createHash('sha256');
  hash.update(str);
  return hash.digest('hex');
}

const isCacheEnable = () => true;

/**
 * 缓存服务
 * 1、过期时间为1min
 * 2、用prompt的hash值作为key
 * 3、缓存数量为10
 */
class PromptCache {
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
    const hash = hashString(prompt);
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
    const hash = hashString(prompt);
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

export default new PromptCache();

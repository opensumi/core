import { Autowired, Injectable, Optional } from '@opensumi/di';
import { isObject, isUndefinedOrNull } from '@opensumi/ide-core-common';

import { Logger } from '../logger';

export const GLOBAL_BROWSER_STORAGE_PREFIX = 'global';
export const SCOPED_BROWSER_STORAGE_PREFIX = 'scoped';

export const StorageService = Symbol('IStorageService');
/**
 * StorageService用于提供给插件或模块进行session级别的数据存储能力
 */
export interface StorageService {
  /**
   * 值设置
   */
  setData<T>(key: string, data: T): void;
  setData<T>(key: string, data: T): Promise<void> | void;

  /**
   * 获取值
   */
  getData<T>(key: string, defaultValue: T): Promise<T>;
  getData<T>(key: string, defaultValue: T): T;
  getData<T>(key: string): Promise<T | undefined>;
  getData<T>(key: string): T | undefined;

  /**
   * 删除值
   */
  removeData(key: string): Promise<void> | void;
  removeData(key: string): void;
}

@Injectable()
abstract class BaseBrowserStorageService implements StorageService {
  // 默认对于 14 天内无使用的 LocalStorage 数据进行清理
  private static EXPIRES_DAY = 14;
  private static EXPIRES_LIMITE_NUMBER = 20;

  @Autowired()
  private logger: Logger;

  private _enableExpired = false;

  /**
   * global/scoped 浏览器层存储定义
   * @param key {string} 存储的唯一 key
   */
  abstract prefix(key: string): string;

  constructor() {
    this.init();
  }

  public setExpires(value: boolean) {
    this._enableExpired = value;
  }

  private get storage(): Storage {
    return window.localStorage;
  }

  private init() {
    if (typeof window !== 'undefined' && window.localStorage) {
      this.clearLocalStorage();
      this.testLocalStorage();
    } else {
      this.logger.warn("The browser doesn't support localStorage. state will not be persisted across sessions.");
    }
  }

  public setData<T>(key: string, data?: T): void {
    if (data !== undefined) {
      try {
        if (isObject(data) && this._enableExpired) {
          // 追加数据过期时间
          data['expires'] = Date.now() + BaseBrowserStorageService.EXPIRES_DAY * 24 * 60 * 60 * 1000;
        }
        this.storage.setItem(this.prefix(key), JSON.stringify(data));
      } catch (e) {
        this.removeExpiringStorage();
      }
    } else {
      this.removeData(key);
    }
  }

  public getData<T>(key: string, defaultValue?: T): T | undefined {
    const result = this.storage.getItem(this.prefix(key));
    if (isUndefinedOrNull(result)) {
      return defaultValue;
    }
    return JSON.parse(result);
  }

  public removeData<T>(key: string): void {
    this.storage.removeItem(this.prefix(key));
  }

  /**
   * 验证是否还有空间生育用来存储另一个工作区配置
   * 如果超出限制大小，提示用户进行清理
   *
   * @private
   * @memberof LocalStorageService
   */
  private testLocalStorage() {
    const keyTest = this.prefix('Test');
    try {
      this.storage.setItem(keyTest, JSON.stringify(new Array(60000)));
    } catch (error) {
      this.removeExpiringStorage();
    } finally {
      this.storage.removeItem(keyTest);
    }
  }

  /**
   * 清理过期的本地存储数据
   */
  private clearLocalStorage() {
    const allKeys = Object.keys(this.storage);
    for (const key of allKeys) {
      try {
        const data = JSON.parse(this.storage[key]);
        if (isObject(data) && data.expires) {
          if (data.expires < Date.now()) {
            this.storage.removeItem(key);
          }
        }
      } catch (e) {
        continue;
      }
    }
  }

  /**
   * 移除即将过期的数据，为后续数据腾出存储空间
   */
  private async removeExpiringStorage(): Promise<void> {
    const allKeys = Object.keys(this.storage);
    const sortedKeys = allKeys
      .filter((key) => this.storage[key]?.indexOf('expires') > 0)
      .sort((a, b) => {
        try {
          const expiresA = JSON.parse(this.storage[a])?.expires;
          const expiresB = JSON.parse(this.storage[b])?.expires;
          return expiresA - expiresB;
        } catch (e) {
          return 0;
        }
      });
    // 移除即将过期的 EXPIRES_LIMITE_NUMBER 个数据
    for (const key of sortedKeys.slice(0, BaseBrowserStorageService.EXPIRES_LIMITE_NUMBER)) {
      this.storage.removeItem(key);
    }
  }
}

/**
 * @internal
 * 全局的浏览器层存储
 */
@Injectable()
export class GlobalBrowserStorageService extends BaseBrowserStorageService {
  prefix(key: string): string {
    return `${GLOBAL_BROWSER_STORAGE_PREFIX}:${key}`;
  }
}

/**
 * @internal
 * scoped 浏览器层存储
 */
@Injectable()
export class ScopedBrowserStorageService extends BaseBrowserStorageService {
  private pathname = 'unknown';

  constructor(@Optional() key: string) {
    super();
    this.pathname = key;
    // 仅对局部 LocalStorage 设置过期时间
    this.setExpires(true);
  }

  prefix(key: string): string {
    return `${SCOPED_BROWSER_STORAGE_PREFIX}:${this.pathname}:${key}`;
  }
}

import { Autowired, Injectable } from '@opensumi/di';
import { warning } from '@opensumi/ide-components/lib/utils';
import { isUndefinedOrNull } from '@opensumi/ide-core-common';

import { Logger } from '../logger';

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
  @Autowired()
  private logger: Logger;

  /**
   * global/scoped 浏览器层存储定义
   * @param key {string} 存储的唯一 key
   */
  abstract prefix(key: string): string;

  constructor() {
    this.init();
  }

  private get storage(): Storage {
    return window.localStorage;
  }

  private init() {
    if (typeof window !== 'undefined' && window.localStorage) {
      this.testLocalStorage();
    } else {
      this.logger.warn("The browser doesn't support localStorage. state will not be persisted across sessions.");
    }
  }

  public setData<T>(key: string, data?: T): void {
    if (data !== undefined) {
      try {
        this.storage.setItem(this.prefix(key), JSON.stringify(data));
      } catch (e) {
        this.showDiskQuotaExceededMessage();
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

  public removeData<T>(key: string, defaultValue?: T): void {
    this.storage.removeItem(this.prefix(key));
  }

  /**
   * 验证是否还有空间生育用来存储另一个工作区配置
   * 如果超出限制大小，提示用户进行清理
   *
   * @private
   * @memberof LocalStorageService
   */
  private testLocalStorage(): void {
    const keyTest = this.prefix('Test');
    try {
      this.storage.setItem(keyTest, JSON.stringify(new Array(60000)));
    } catch (error) {
      this.showDiskQuotaExceededMessage();
    } finally {
      this.storage.removeItem(keyTest);
    }
  }

  private async showDiskQuotaExceededMessage(): Promise<void> {
    const READ_INSTRUCTIONS_ACTION = 'Read Instructions';
    const CLEAR_STORAGE_ACTION = 'Clear Local Storage';
    const ERROR_MESSAGE = `Your preferred browser's local storage is almost full.
        To be able to save your current workspace layout or data, you may need to free up some space.`;
    this.logger.log(READ_INSTRUCTIONS_ACTION, CLEAR_STORAGE_ACTION, ERROR_MESSAGE);
  }
}

/**
 * @internal
 * 全局的浏览器层存储
 */
@Injectable()
export class GlobalBrowserStorageService extends BaseBrowserStorageService {
  prefix(key: string): string {
    return `kt-global:${key}`;
  }
}

/**
 * @internal
 * scoped 浏览器层存储
 */
@Injectable()
export class ScopedBrowserStorageService extends BaseBrowserStorageService {
  /**
   * 目前这里的 key 是从 location 获取
   * 存在一定问题，这里的 key 改成 workspaceDir 更合适
   */
  prefix(key: string): string {
    const pathname = typeof window === 'undefined' ? '' : window.location.pathname;
    return `kt:${pathname}:${key}`;
  }
}

/**
 * @deprecated please use `ScopedBrowserStorageService` instead
 */
@Injectable()
export class LocalStorageService extends ScopedBrowserStorageService {
  constructor() {
    super();
    warning(false, 'LocalStorageService is deprecated please consider using `ScopedBrowserStorageService` instead');
  }
}

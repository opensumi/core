import { Autowired, Injectable } from '@ali/common-di';
import { Logger } from './logger';

export const StorageService = Symbol('IStorageService');
/**
 * The storage service provides an interface to some data storage that allows extensions to keep state among sessions.
 */
export interface StorageService {

  /**
   * Stores the given data under the given key.
   */
  setData<T>(key: string, data: T): Promise<void>;

  /**
   * Returns the data stored for the given key or the provided default value if nothing is stored for the given key.
   */
  getData<T>(key: string, defaultValue: T): Promise<T>;
  getData<T>(key: string): Promise<T | undefined>;
}

interface LocalStorage {
  // tslint:disable-next-line:no-any
  [key: string]: any;
}

@Injectable()
export class LocalStorageService implements StorageService {
  private storage: LocalStorage;

  @Autowired() protected logger: Logger;

  constructor() {
    this.init();
  }

  protected init() {
    if (typeof window !== 'undefined' && window.localStorage) {
      this.storage = window.localStorage;
      this.testLocalStorage();
    } else {
      this.logger.warn("The browser doesn't support localStorage. state will not be persisted across sessions.");
      this.storage = {};
    }
  }

  setData<T>(key: string, data?: T): Promise<void> {
    if (data !== undefined) {
      try {
        this.storage[this.prefix(key)] = JSON.stringify(data);
      } catch (e) {
        this.showDiskQuotaExceededMessage();
      }
    } else {
      delete this.storage[this.prefix(key)];
    }
    return Promise.resolve();
  }

  getData<T>(key: string, defaultValue?: T): Promise<T | undefined> {
    const result = this.storage[this.prefix(key)];
    if (result === undefined) {
      return Promise.resolve(defaultValue);
    }
    return Promise.resolve(JSON.parse(result));
  }

  protected prefix(key: string): string {
    const pathname = typeof window === 'undefined' ? '' : window.location.pathname;
    return `kt:${pathname}:${key}`;
  }

  private async showDiskQuotaExceededMessage(): Promise<void> {
    const READ_INSTRUCTIONS_ACTION = 'Read Instructions';
    const CLEAR_STORAGE_ACTION = 'Clear Local Storage';
    const ERROR_MESSAGE = `Your preferred browser's local storage is almost full.
        To be able to save your current workspace layout or data, you may need to free up some space.
        You can refer to Theia's documentation page for instructions on how to manually clean
        your browser's local storage or choose to clear all.`;
    this.logger.log(READ_INSTRUCTIONS_ACTION, CLEAR_STORAGE_ACTION, ERROR_MESSAGE);
  }

  /**
   * Verify if there is still some spaces left to save another workspace configuration into the local storage of your browser.
   * If we are close to the limit, use a dialog to notify the user.
   */
  private testLocalStorage(): void {
    const keyTest = this.prefix('Test');
    try {
      this.storage[keyTest] = JSON.stringify(new Array(60000));
    } catch (error) {
      this.showDiskQuotaExceededMessage();
    } finally {
      this.storage.removeItem(keyTest);
    }
  }

  private clearStorage(): void {
    this.storage.clear();
  }

}

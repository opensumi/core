import { Injectable, Autowired } from '@ali/common-di';
import { StorageProvider, IStorage, STORAGE_NAMESPACE } from '@ali/ide-core-common';
import debounce = require('lodash.debounce');

@Injectable()
export class LayoutState {
  @Autowired(StorageProvider)
  private getStorage: StorageProvider;

  private layoutStorage: IStorage;
  private globalLayoutStorage: IStorage;

  async initStorage() {
    this.layoutStorage = await this.getStorage(STORAGE_NAMESPACE.LAYOUT);
    this.globalLayoutStorage = await this.getStorage(STORAGE_NAMESPACE.GLOBAL_LAYOUT);
  }

  getState<T>(key: string, defaultState: T): T {
    let storedState: T;
    try {
      storedState = LAYOUT_STATE.isScoped(key) ? this.layoutStorage.get<any>(key, defaultState) : this.globalLayoutStorage.get<any>(key, defaultState);
    } catch (err) {
      console.warn('Layout state parse出错，使用默认state');
      storedState = defaultState;
    }
    return storedState;
  }

  setState(key: string, state: object) {
    this.debounceSave(key, state);
  }

  private debounceSave = debounce((key, state) => {
    LAYOUT_STATE.isScoped(key) ? this.layoutStorage.set(key, state) : this.globalLayoutStorage.set(key, state);
  }, 60);
}

export namespace LAYOUT_STATE {

  export const MAIN = 'layout';

  export function getContainerSpace(containerId: string) {
    return `view/${containerId}`;
  }

  export function isScoped(key: string) {
    return key.startsWith('view/');
  }

  export function getTabbarSpace(location: string) {
    return `tabbar/${location}`;
  }

}

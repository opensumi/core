import { Injectable, Autowired } from '@ali/common-di';
import { StorageProvider, IStorage, STORAGE_NAMESPACE, DisposableCollection, ILogger } from '@ali/ide-core-common';
import debounce = require('lodash.debounce');
import { PreferenceService } from '../preferences';

@Injectable()
export class LayoutState {
  @Autowired(StorageProvider)
  private readonly getStorage: StorageProvider;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired(ILogger)
  private readonly logger: ILogger;

  private layoutStorage: IStorage;
  private globalLayoutStorage: IStorage;
  private saveLayoutWithWorkspace: boolean;
  private disposableCollection: DisposableCollection = new DisposableCollection();

  async initStorage() {
    this.layoutStorage = await this.getStorage(STORAGE_NAMESPACE.LAYOUT);
    this.globalLayoutStorage = await this.getStorage(STORAGE_NAMESPACE.GLOBAL_LAYOUT);
    await this.preferenceService.ready;
    this.saveLayoutWithWorkspace = this.preferenceService.get<boolean>('view.saveLayoutWithWorkspace') || false;
    this.disposableCollection.push(this.preferenceService.onPreferenceChanged((e) => {
      if (e.preferenceName === 'view.saveLayoutWithWorkspace') {
        this.saveLayoutWithWorkspace = e.newValue;
      }
    }));
  }

  getState<T>(key: string, defaultState: T): T {
    let storedState: T;
    try {
      if (this.saveLayoutWithWorkspace) {
        storedState = LAYOUT_STATE.isScoped(key) || LAYOUT_STATE.isLayout(key) ? this.layoutStorage.get<any>(key, defaultState) : this.globalLayoutStorage.get<any>(key, defaultState);
      } else {
        storedState = LAYOUT_STATE.isScoped(key) ? this.layoutStorage.get<any>(key, defaultState) : this.globalLayoutStorage.get<any>(key, defaultState);
      }
    } catch (err) {
      this.logger.warn('Layout state parse 出错，使用默认 state');
      storedState = defaultState;
    }
    return storedState;
  }

  setState(key: string, state: object) {
    this.debounceSave(key, state);
  }

  private debounceSave = debounce((key, state) => {
    if (this.saveLayoutWithWorkspace) {
      LAYOUT_STATE.isScoped(key) || LAYOUT_STATE.isLayout(key) ? this.layoutStorage.set(key, state) : this.globalLayoutStorage.set(key, state);
    } else {
      LAYOUT_STATE.isScoped(key) ? this.layoutStorage.set(key, state) : this.globalLayoutStorage.set(key, state);
    }
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

  export function isLayout(key: string) {
    return key.startsWith(LAYOUT_STATE.MAIN);
  }

  export function getTabbarSpace(location: string) {
    return `tabbar/${location}`;
  }

}

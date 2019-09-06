import { Injectable, Autowired } from '@ali/common-di';
import { StorageProvider, IStorage, STORAGE_NAMESPACE } from '@ali/ide-core-common';

@Injectable()
export class LayoutState {
  @Autowired(StorageProvider)
  private getStorage: StorageProvider;

  private layoutStorage: IStorage;

  async initStorage() {
    this.layoutStorage = await this.getStorage(STORAGE_NAMESPACE.LAYOUT);
  }

  getState<T>(key: string, defaultState: T): T {
    let storedState: T;
    try {
      storedState = JSON.parse(this.layoutStorage.get(key, JSON.stringify(defaultState)));
    } catch (err) {
      console.warn('Layout state parse出错，使用默认state');
      storedState = defaultState;
    }
    return storedState;
  }

  setState(key: string, state: object) {
    this.layoutStorage.set(key, JSON.stringify(state));
  }
}

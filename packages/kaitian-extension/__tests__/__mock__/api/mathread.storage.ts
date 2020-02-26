import { IMainThreadStorage, KeysToAnyValues } from '@ali/ide-kaitian-extension/lib/common/vscode';

export class MainThreadStorage implements IMainThreadStorage {
  private storages: Map<string, any>;
  constructor() {
    this.init();
  }
  public dispose() {}

  async init() {
    this.storages = new Map();
  }

  $setValue(shared: boolean, key: string, value: KeysToAnyValues) {
    try {
      this.storages.set(key, value);
    } catch (err) {
      return Promise.reject(err);
    }
    return Promise.resolve(undefined);
  }

  $getValue(shared: boolean, key: string) {
    try {
      return Promise.resolve(this.storages.get(key));
    } catch (error) {
      return Promise.reject(error);
    }
  }
}
